from django.db import models

class K8sEvent(models.Model):
    class Kind(models.TextChoices):
        DEPLOYMENT = 'deployment', 'Deployment'
        REPLICASET = 'replicaset', 'ReplicaSet'
        STATEFULSET = 'statefulset', 'StatefulSet'
        DAEMONSET = 'daemonset', 'DaemonSet'
        CONFIGMAP = 'configmap', 'ConfigMap'
        SECRET = 'secret', 'Secret'
        SERVICE = 'service', 'Service'
        HPA = 'hpa', 'HorizontalPodAutoscaler'
        
    class Action(models.TextChoices):
        CREATE = 'create', 'Create'
        UPDATE = 'update', 'Update'
        DELETE = 'delete', 'Delete'
        SCALE = 'scale', 'Scale'
    
    project = models.ForeignKey('core.Project', on_delete=models.CASCADE, related_name='k8s_events')
    timestamp = models.DateTimeField()
    kind = models.CharField(max_length=30, choices=Kind.choices)
    namespace = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    action = models.CharField(max_length=20, choices=Action.choices)
    details = models.JSONField(default=dict)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['project', '-timestamp']),
            models.Index(fields=['namespace', 'name']),
        ]

    def __str__(self):
        return f"{self.action} {self.kind} {self.namespace}/{self.name}"

class Correlation(models.Model):
    anomaly = models.ForeignKey('detector.Anomaly', on_delete=models.CASCADE, related_name='correlations')
    k8s_event = models.ForeignKey(K8sEvent, on_delete=models.CASCADE, related_name='correlations')
    time_delta_seconds = models.IntegerField()
    confidence_score = models.FloatField()
    explanation = models.TextField()
    
    class Meta:
        ordering = ['-confidence_score']
        unique_together = [('anomaly', 'k8s_event')]

    def __str__(self):
        return f"Corr: {self.anomaly_id} <-> {self.k8s_event_id} ({self.confidence_score})"
