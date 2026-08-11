import pytest
from unittest.mock import patch, MagicMock
from nas_logs.client import NASLogsClient, NASLogsError

class TestNASLogsSDK:

    @patch('urllib.request.urlopen')
    def test_sdk_send_telemetry_batch_success(self, mock_urlopen):
        """Verify SDK serializes JSON payload and posts to DSN endpoint correctly."""
        mock_resp = MagicMock()
        mock_resp.read.return_value = b'{"status": "ok", "processed": 2}'
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        client = NASLogsClient("http://localhost:8000/api/collector/v1/ingest/1")
        res = client.send_telemetry_batch([
            {"namespace": "prod", "controller_name": "cart", "network_cost": 12.5}
        ])

        assert res["status"] == "ok"
        assert res["processed"] == 2
        mock_urlopen.assert_called_once()

    @patch('urllib.request.urlopen')
    def test_sdk_handles_connection_error(self, mock_urlopen):
        """Verify SDK raises NASLogsError when HTTP request fails."""
        import urllib.error
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

        client = NASLogsClient("http://localhost:8000/api/collector/v1/ingest/1")
        with pytest.raises(NASLogsError, match="Failed to transmit telemetry"):
            client.send_telemetry_batch([{"namespace": "prod"}])
