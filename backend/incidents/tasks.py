from celery import shared_task
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
        
        return incident.id
    except Anomaly.DoesNotExist:
        pass
