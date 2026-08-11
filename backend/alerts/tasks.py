from celery import shared_task
from incidents.models import Incident
from .models import AlertRule, AlertHistory
from .backends import SlackBackend, EmailBackend

@shared_task
def send_incident_alerts(incident_id):
    try:
        incident = Incident.objects.select_related('project').get(id=incident_id)
        rules = AlertRule.objects.filter(project=incident.project, is_active=True)
        
        if incident.severity:
            rules = [r for r in rules if not r.severity_filter or r.severity_filter == incident.severity]
            
        for rule in rules:
            success = False
            response = ""
            
            if rule.channel_type == AlertRule.ChannelType.SLACK:
                webhook_url = rule.channel_config.get('webhook_url')
                if webhook_url:
                    success, response = SlackBackend.send(webhook_url, incident)
            elif rule.channel_type == AlertRule.ChannelType.EMAIL:
                to_email = rule.channel_config.get('to')
                if to_email:
                    success, response = EmailBackend.send(to_email, incident)
                    
            AlertHistory.objects.create(
                incident=incident,
                alert_rule=rule,
                status=AlertHistory.DeliveryStatus.SENT if success else AlertHistory.DeliveryStatus.FAILED,
                response_body=response
            )
    except Incident.DoesNotExist:
        pass
