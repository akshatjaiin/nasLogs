import requests
import logging

logger = logging.getLogger(__name__)

class SlackBackend:
    @staticmethod
    def send(webhook_url, incident):
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"🚨 {incident.title}",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Severity:* {incident.severity}\\n*Summary:* {incident.summary}"
                }
            }
        ]
        
        payload = {"blocks": blocks}
        try:
            resp = requests.post(webhook_url, json=payload, timeout=10)
            resp.raise_for_status()
            return True, resp.text
        except Exception as e:
            logger.error(f"Slack send failed: {e}")
            return False, str(e)

class EmailBackend:
    @staticmethod
    def send(to_email, incident):
        logger.info(f"Would send email to {to_email} for incident {incident.id}")
        return True, "Email sent (placeholder)"
