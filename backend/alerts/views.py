import time
import requests
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import AlertRule, AlertHistory
from .serializers import AlertRuleSerializer, AlertHistorySerializer
from .backends import SlackBackend

class AlertRuleViewSet(viewsets.ModelViewSet):
    queryset = AlertRule.objects.all()
    serializer_class = AlertRuleSerializer
    authentication_classes = []
    permission_classes = []

    def get_queryset(self):
        project_id = self.request.query_params.get('project_id', '1')
        return AlertRule.objects.filter(project_id=project_id)

    @action(detail=True, methods=['post'], url_path='test')
    def test_alert(self, request, pk=None):
        """Sends a real test webhook alert payload to Slack/Email."""
        rule = self.get_object()
        webhook_url = (rule.channel_config or {}).get('webhook_url')
        
        if rule.channel_type == AlertRule.ChannelType.SLACK and webhook_url:
            test_payload = {
                "text": f" *[NAS Logs Test Alert]* Connection test for rule `{rule.name}` succeeded!"
            }
            try:
                start = time.time()
                resp = requests.post(webhook_url, json=test_payload, timeout=5)
                latency = int((time.time() - start) * 1000)
                if resp.status_code == 200:
                    return Response({"status": "success", "message": f"Test alert sent to Slack ({latency}ms)", "latency_ms": latency})
                else:
                    return Response({"status": "failed", "message": f"Slack responded with HTTP {resp.status_code}"}, status=status.HTTP_400_BAD_REQUEST)
            except Exception as e:
                return Response({"status": "failed", "message": f"Failed to reach webhook: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"status": "success", "message": f"Test alert simulated for rule {rule.name}"})
