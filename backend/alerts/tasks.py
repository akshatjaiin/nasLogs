from celery import shared_task
from incidents.models import Incident
from .models import AlertRule, AlertHistory
from .backends import SlackBackend, EmailBackend
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger('nas_logs')

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


@shared_task
def send_alert_digest():
    """Sentry-inspired digest: batch recent incidents into a single notification per alert rule.
    
    Runs via Celery Beat every 5 minutes. Instead of one notification per incident,
    collects all un-alerted incidents from the last 5 minutes and sends a single digest.
    """
    cutoff = timezone.now() - timedelta(minutes=5)
    
    # Find incidents created in the last 5 minutes that haven't been alerted yet
    recent_incidents = Incident.objects.filter(
        created_at__gte=cutoff
    ).exclude(
        id__in=AlertHistory.objects.filter(sent_at__gte=cutoff).values_list('incident_id', flat=True)
    ).select_related('project')

    if not recent_incidents.exists():
        return

    # Group by project
    from collections import defaultdict
    by_project = defaultdict(list)
    for inc in recent_incidents:
        by_project[inc.project_id].append(inc)

    for project_id, incidents in by_project.items():
        rules = AlertRule.objects.filter(project_id=project_id, is_active=True)
        
        for rule in rules:
            # Filter by severity
            matching = [
                inc for inc in incidents
                if not rule.severity_filter or rule.severity_filter == inc.severity
            ]
            if not matching:
                continue

            if rule.channel_type == AlertRule.ChannelType.SLACK:
                webhook_url = rule.channel_config.get('webhook_url')
                if webhook_url:
                    _send_slack_digest(webhook_url, matching, rule)
            elif rule.channel_type == AlertRule.ChannelType.EMAIL:
                to_email = rule.channel_config.get('to')
                if to_email:
                    _send_email_digest(to_email, matching, rule)


def _send_slack_digest(webhook_url, incidents, rule):
    """Send a batched Slack digest for multiple incidents."""
    import requests
    
    summary_lines = []
    for inc in incidents[:10]:  # Cap at 10 to avoid message limits
        emoji = "🔴" if inc.severity == 'critical' else "🟡"
        summary_lines.append(f"{emoji} *{inc.title}* — {inc.summary[:80]}")

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"NAS Logs Digest: {len(incidents)} new incident(s)",
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "\n".join(summary_lines)
            }
        }
    ]

    if len(incidents) > 10:
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"_...and {len(incidents) - 10} more_"}]
        })

    try:
        resp = requests.post(webhook_url, json={"blocks": blocks}, timeout=10)
        resp.raise_for_status()
        for inc in incidents:
            AlertHistory.objects.create(
                incident=inc, alert_rule=rule,
                status=AlertHistory.DeliveryStatus.SENT, response_body='digest'
            )
    except Exception as e:
        logger.error(f"Slack digest failed: {e}")
        for inc in incidents:
            AlertHistory.objects.create(
                incident=inc, alert_rule=rule,
                status=AlertHistory.DeliveryStatus.FAILED, response_body=str(e)
            )


def _send_email_digest(to_email, incidents, rule):
    """Send a batched email digest for multiple incidents."""
    from django.core.mail import send_mail
    from django.conf import settings

    subject = f"[NAS Logs] Digest: {len(incidents)} new cost incident(s)"
    lines = [f"NAS Logs detected {len(incidents)} new incident(s):\n"]
    for inc in incidents:
        lines.append(f"  [{inc.severity.upper()}] {inc.title}")
        lines.append(f"    {inc.summary}")
        lines.append(f"    View: {settings.SITE_URL}/incidents/{inc.id}\n")

    body = "\n".join(lines)
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'alerts@naslogs.io')

    try:
        send_mail(subject=subject, message=body, from_email=from_email,
                  recipient_list=[to_email], fail_silently=False)
        for inc in incidents:
            AlertHistory.objects.create(
                incident=inc, alert_rule=rule,
                status=AlertHistory.DeliveryStatus.SENT, response_body='digest'
            )
    except Exception as e:
        logger.error(f"Email digest failed: {e}")
        for inc in incidents:
            AlertHistory.objects.create(
                incident=inc, alert_rule=rule,
                status=AlertHistory.DeliveryStatus.FAILED, response_body=str(e)
            )

