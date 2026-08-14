from celery import shared_task
from collector.models import CostSnapshot
from .engine import AnomalyDetector

@shared_task
def detect_anomalies(snapshot_id):
    try:
        snapshot = CostSnapshot.objects.select_related('project').get(id=snapshot_id)
        detector = AnomalyDetector(snapshot.project)
        anomalies = detector.run_detection(snapshot)
        
        # Create incidents for detected anomalies (mirrors IngestTelemetryView behavior)
        if anomalies:
            from incidents.tasks import create_incident
            for anomaly in anomalies:
                try:
                    create_incident.delay(anomaly.id)
                except Exception:
                    create_incident(anomaly.id)
        
    except CostSnapshot.DoesNotExist:
        pass

@shared_task
def detect_all_active_anomalies():
    """Periodic task: run anomaly detection on the latest snapshot for each active project."""
    import logging
    from core.models import Project
    logger = logging.getLogger('nas_logs')
    
    for project in Project.objects.filter(is_active=True):
        latest_snapshot = CostSnapshot.objects.filter(
            project=project
        ).order_by('-timestamp').first()
        
        if latest_snapshot:
            try:
                detector = AnomalyDetector(project)
                anomalies = detector.run_detection(latest_snapshot)
                logger.info(f"Anomaly detection for project {project.name}: {len(anomalies)} anomalies found")
            except Exception as e:
                logger.error(f"Anomaly detection failed for project {project.name}: {e}")
