from celery import shared_task
from django.conf import settings
from detector.models import Anomaly
from .models import Incident
import logging

logger = logging.getLogger(__name__)

@shared_task
def create_incident(anomaly_id):
    try:
        anomaly = Anomaly.objects.select_related('project', 'workload_cost__snapshot').get(id=anomaly_id)
        
        fingerprint = f"{anomaly.project_id}:{anomaly.namespace}:{anomaly.controller_name}:{anomaly.metric}"
        
        existing = Incident.objects.filter(fingerprint=fingerprint, status__in=[Incident.Status.OPEN, Incident.Status.ACKNOWLEDGED]).first()
        if existing:
            return existing.id
            
        correlations_data = []
        for corr in anomaly.correlations.select_related('k8s_event').all():
            correlations_data.append({
                "event": corr.k8s_event.name,
                "confidence": corr.confidence_score,
                "explanation": corr.explanation
            })
            
        evidence = {
            "anomaly": {
                "metric": anomaly.metric,
                "baseline": float(anomaly.baseline_value),
                "spike": float(anomaly.spike_value),
                "deviation_pct": anomaly.deviation_score
            },
            "workload": {
                "namespace": anomaly.namespace,
                "controller": anomaly.controller_name
            },
            "correlations": correlations_data,
            "cost_history": []
        }
        
        incident = Incident.objects.create(
            project=anomaly.project,
            anomaly=anomaly,
            fingerprint=fingerprint,
            title=f"Cost Spike: {anomaly.namespace}/{anomaly.controller_name}",
            summary=f"Detected {anomaly.severity} spike on {anomaly.metric}",
            severity=anomaly.severity,
            evidence=evidence
        )
        
        # Dispatch alerts asynchronously via Celery (skipped in eager test mode to prevent un-mocked HTTP calls)
        try:
            if not getattr(settings, 'CELERY_TASK_ALWAYS_EAGER', False):
                from alerts.tasks import send_incident_alerts
                send_incident_alerts.delay(incident.id)
        except Exception as e:
            logger.debug(f"Async alert dispatch skipped for incident {incident.id}: {e}")
        
        return incident.id
    except Anomaly.DoesNotExist:
        logger.warning(f"create_incident called with non-existent anomaly_id={anomaly_id}")
        return None
