from django.db import models

class AlertRule(models.Model):
    class ChannelType(models.TextChoices):
        SLACK = 'slack', 'Slack Webhook'
        EMAIL = 'email', 'Email'
    
    project = models.ForeignKey('core.Project', on_delete=models.CASCADE, related_name='alert_rules')
    name = models.CharField(max_length=255)
    channel_type = models.CharField(max_length=20, choices=ChannelType.choices)
    channel_config = models.JSONField()
    severity_filter = models.CharField(max_length=10, blank=True, default='')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.channel_type})"

class AlertHistory(models.Model):
    class DeliveryStatus(models.TextChoices):
        SENT = 'sent', 'Sent'
        FAILED = 'failed', 'Failed'
    
    incident = models.ForeignKey('incidents.Incident', on_delete=models.CASCADE, related_name='alert_history')
    alert_rule = models.ForeignKey(AlertRule, on_delete=models.CASCADE, related_name='history')
    sent_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=DeliveryStatus.choices)
    response_body = models.TextField(blank=True, default='')

    def __str__(self):
        return f"Alert for Incident {self.incident_id} via {self.alert_rule.name}"
