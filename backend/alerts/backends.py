import requests
import logging
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger('nas_logs')


class SlackBackend:
    @staticmethod
    def send(webhook_url, incident):
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"NAS Logs Alert: {incident.title}",
                    "emoji": False
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Severity:* {incident.severity}\n*Summary:* {incident.summary}\n*Fingerprint:* `{incident.fingerprint}`"
                }
            }
        ]

        payload = {"blocks": blocks}
        try:
            resp = requests.post(webhook_url, json=payload, timeout=10)
            resp.raise_for_status()
            return True, resp.text
        except Exception as e:
            logger.error(f"Slack delivery failed for incident {incident.id}: {e}")
            return False, str(e)


class EmailBackend:
    @staticmethod
    def send(to_email, incident):
        """Send a real email alert using Django's email backend."""
        subject = f"[NAS Logs] {incident.severity.upper()}: {incident.title}"
        body = (
            f"Incident: {incident.title}\n"
            f"Severity: {incident.severity}\n"
            f"Summary: {incident.summary}\n"
            f"Fingerprint: {incident.fingerprint}\n"
            f"Status: {incident.status}\n\n"
            f"View in dashboard: {settings.SITE_URL}/incidents/{incident.id}\n"
        )
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'alerts@naslogs.io')

        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=from_email,
                recipient_list=[to_email],
                fail_silently=False,
            )
            logger.info(f"Email alert sent to {to_email} for incident {incident.id}")
            return True, f"Email sent to {to_email}"
        except Exception as e:
            logger.error(f"Email delivery failed for incident {incident.id} to {to_email}: {e}")
            return False, str(e)
