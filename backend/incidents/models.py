from django.db import models

class Incident(models.Model):
    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
        RESOLVED = 'resolved', 'Resolved'
    
    project = models.ForeignKey('core.Project', on_delete=models.CASCADE, related_name='incidents')
    anomaly = models.OneToOneField('detector.Anomaly', on_delete=models.CASCADE, related_name='incident')
    
    fingerprint = models.CharField(max_length=255, db_index=True)
    title = models.CharField(max_length=500)
    summary = models.TextField()
    severity = models.CharField(max_length=10)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    
    evidence = models.JSONField(default=dict)
    
    created_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', 'status', '-created_at']),
            models.Index(fields=['fingerprint']),
        ]

    def __str__(self):
        return f"{self.project.name} - {self.title}"
