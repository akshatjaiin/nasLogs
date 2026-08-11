from celery import shared_task
from detector.models import Anomaly
from .engine import CorrelationEngine
import logging

logger = logging.getLogger(__name__)

@shared_task
def correlate_anomaly(anomaly_id):
    try:
        anomaly = Anomaly.objects.select_related('project', 'workload_cost__snapshot').get(id=anomaly_id)
        engine = CorrelationEngine()
        engine.correlate(anomaly)
        
    except Anomaly.DoesNotExist:
        pass

@shared_task
def sync_k8s_events(project_id):
    logger.info(f"Would sync k8s events for project {project_id}")
