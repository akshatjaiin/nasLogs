import json
import urllib.request
import urllib.error
import urllib.parse
import threading
import logging
import time
import gzip
from typing import Dict, Any, List, Optional
from collections import deque

logger = logging.getLogger('nas_logs.sdk')


class NASLogsError(Exception):
    """Base exception for NAS Logs SDK."""
    pass


class NASLogsClient:
    """
    Python SDK for NAS Logs network cost telemetry.
    
    Features:
    - Lazy background flush thread (non-blocking)
    - In-memory ring buffer with configurable max size
    - Automatic batching on flush interval
    - Retry with exponential backoff
    - DSN URL parsing to extract project ID and API key
    - Gzip compression
    - Safe degradation (drops telemetry silently when buffer is full)
    """

    def __init__(
        self,
        dsn: str,
        flush_interval: float = 60.0,
        max_buffer_size: int = 10000,
        batch_size: int = 500,
        max_retries: int = 3,
        timeout: int = 10,
        compress: bool = False,
        auto_start_thread: bool = False,
    ):
        self.dsn = dsn
        self._endpoint, self._api_key = self._parse_dsn(dsn)
        self._flush_interval = flush_interval
        self._max_buffer_size = max_buffer_size
        self._batch_size = batch_size
        self._max_retries = max_retries
        self._timeout = timeout
        self.timeout = timeout
        self._compress = compress

        self._buffer: deque = deque(maxlen=max_buffer_size)
        self._lock = threading.Lock()
        self._shutdown = threading.Event()
        self._dropped_count = 0
        self._flush_thread: Optional[threading.Thread] = None

        if auto_start_thread:
            self._ensure_thread_started()

    def _ensure_thread_started(self):
        if self._flush_thread is None or not self._flush_thread.is_alive():
            self._flush_thread = threading.Thread(target=self._flush_loop, daemon=True)
            self._flush_thread.start()

    @staticmethod
    def _parse_dsn(dsn: str) -> tuple:
        """Parse DSN like http://API_KEY@host:port/api/collector/v1/ingest/PROJECT_ID"""
        parsed = urllib.parse.urlparse(dsn)
        api_key = parsed.username or ''
        # Rebuild URL without credentials
        netloc = parsed.hostname or ''
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        endpoint = urllib.parse.urlunparse((
            parsed.scheme, netloc, parsed.path,
            parsed.params, parsed.query, parsed.fragment
        ))
        return endpoint.rstrip('/') + '/', api_key

    def send_telemetry_batch(self, workload_costs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Synchronously transmits aggregated workload egress cost records to central backend.
        Raises NASLogsError if network transmission fails.
        """
        payload = json.dumps({"workloads": workload_costs}).encode('utf-8')
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "NASLogs-Python-SDK/0.2.0"
        }
        if self._api_key:
            headers["X-Project-Key"] = self._api_key

        req = urllib.request.Request(self._endpoint, data=payload, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                data = resp.read().decode('utf-8')
                return json.loads(data) if data else {"status": "ok"}
        except Exception as e:
            raise NASLogsError(f"Failed to transmit telemetry to NAS Logs: {e}")

    def capture(self, workload: Dict[str, Any]) -> None:
        """Add a single workload cost record to the buffer (non-blocking)."""
        self._ensure_thread_started()
        with self._lock:
            if len(self._buffer) >= self._max_buffer_size:
                self._dropped_count += 1
                if self._dropped_count % 1000 == 1:
                    logger.warning(f"NAS Logs buffer full. {self._dropped_count} records dropped total.")
                return
            self._buffer.append(workload)

    def capture_batch(self, workloads: List[Dict[str, Any]]) -> None:
        """Add multiple workload cost records to the buffer."""
        for w in workloads:
            self.capture(w)

    def flush(self) -> Optional[Dict[str, Any]]:
        """Immediately flush the current buffer to the backend."""
        with self._lock:
            if not self._buffer:
                return None
            batch = list(self._buffer)
            self._buffer.clear()

        # Send in chunks of batch_size
        for i in range(0, len(batch), self._batch_size):
            chunk = batch[i:i + self._batch_size]
            self._send_with_retry(chunk)

        return {"flushed": len(batch)}

    def shutdown(self, timeout: float = 2.0) -> None:
        """Flush remaining buffer and stop background thread."""
        logger.info("NAS Logs SDK shutting down...")
        self._shutdown.set()
        self.flush()
        if self._flush_thread and self._flush_thread.is_alive():
            self._flush_thread.join(timeout=timeout)
        if self._dropped_count > 0:
            logger.warning(f"NAS Logs SDK: {self._dropped_count} records were dropped during this session.")

    def _flush_loop(self) -> None:
        """Background thread that flushes buffer at regular intervals."""
        while not self._shutdown.is_set():
            self._shutdown.wait(timeout=self._flush_interval)
            if self._shutdown.is_set():
                break
            try:
                self.flush()
            except Exception as e:
                logger.error(f"NAS Logs flush error: {e}")

    def _send_with_retry(self, workloads: List[Dict[str, Any]]) -> None:
        """Send a batch with exponential backoff retry."""
        payload = json.dumps({"workloads": workloads}).encode('utf-8')

        if self._compress:
            payload = gzip.compress(payload)

        for attempt in range(self._max_retries):
            try:
                headers = {
                    "Content-Type": "application/json",
                    "User-Agent": "NASLogs-Python-SDK/0.2.0",
                }
                if self._api_key:
                    headers["X-Project-Key"] = self._api_key
                if self._compress:
                    headers["Content-Encoding"] = "gzip"

                req = urllib.request.Request(
                    self._endpoint, data=payload, headers=headers
                )
                with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                    resp.read()
                return  # Success
            except urllib.error.URLError as e:
                wait = (2 ** attempt) * 0.5
                logger.warning(f"NAS Logs send attempt {attempt + 1}/{self._max_retries} failed: {e}. Retrying in {wait}s.")
                time.sleep(wait)
            except Exception as e:
                logger.error(f"NAS Logs unexpected send error: {e}")
                return

        logger.error(f"NAS Logs: failed to send batch of {len(workloads)} after {self._max_retries} retries. Data dropped.")
