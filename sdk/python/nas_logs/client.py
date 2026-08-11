import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional

class NASLogsError(Exception):
    """Base exception for NAS Logs SDK."""
    pass

class NASLogsClient:
    """Python Client SDK for NAS Logs Network Telemetry Ingestion."""
    
    def __init__(self, dsn: str, timeout: int = 10):
        """
        Initialize NAS Logs client with Project DSN.
        Example DSN: http://nas_live_9f8a37b120c@localhost:8000/api/collector/v1/ingest/1
        """
        self.dsn = dsn
        self.timeout = timeout

    def send_telemetry_batch(self, workload_costs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Sends aggregated workload egress cost records to central backend.
        """
        payload = json.dumps({"workloads": workload_costs}).encode('utf-8')
        req = urllib.request.Request(
            self.dsn,
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "NASLogs-Python-SDK/0.1.0"}
        )
        
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except urllib.error.URLError as e:
            raise NASLogsError(f"Failed to transmit telemetry to NAS Logs: {e}")
