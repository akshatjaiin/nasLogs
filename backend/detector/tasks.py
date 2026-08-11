from celery import shared_task
from collector.models import CostSnapshot
from .engine import AnomalyDetector

@shared_task
def detect_anomalies(snapshot_id):
    try:
        snapshot = CostSnapshot.objects.select_related('project').get(id=snapshot_id)
        detector = AnomalyDetector(snapshot.project)
        anomalies = detector.run_detection(snapshot)
        
    except CostSnapshot.DoesNotExist:
        pass
