from django.db import models

class AnomalyThreshold(models.Model):
    class Method(models.TextChoices):
        PCT_CHANGE = 'pct_change', 'Percentage Change'
        ZSCORE = 'zscore', 'Z-Score'
        
    class Severity(models.TextChoices):
        WARNING = 'warning', 'Warning'
        CRITICAL = 'critical', 'Critical'
    
    project = models.ForeignKey('core.Project', on_delete=models.CASCADE, related_name='thresholds')
    metric = models.CharField(max_length=50, default='network_cost_total')
    method = models.CharField(max_length=20, choices=Method.choices, default=Method.PCT_CHANGE)
    warning_value = models.FloatField(default=2.0)
    critical_value = models.FloatField(default=5.0)
    baseline_window_hours = models.IntegerField(default=168)
    min_cost_threshold = models.DecimalField(max_digits=10, decimal_places=4, default=0.01)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.project.name} - {self.metric} ({self.method})"

class Anomaly(models.Model):
    class Severity(models.TextChoices):
        WARNING = 'warning', 'Warning'
        CRITICAL = 'critical', 'Critical'
    
    project = models.ForeignKey('core.Project', on_delete=models.CASCADE, related_name='anomalies')
    workload_cost = models.ForeignKey('collector.WorkloadCost', on_delete=models.CASCADE, related_name='anomalies')
    threshold = models.ForeignKey(AnomalyThreshold, on_delete=models.SET_NULL, null=True)
    
    detected_at = models.DateTimeField(auto_now_add=True)
    metric = models.CharField(max_length=50)
    baseline_value = models.DecimalField(max_digits=12, decimal_places=6)
    spike_value = models.DecimalField(max_digits=12, decimal_places=6)
    deviation_score = models.FloatField()
    severity = models.CharField(max_length=10, choices=Severity.choices)
    
    namespace = models.CharField(max_length=255)
    controller_name = models.CharField(max_length=255)
    
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['project', '-detected_at']),
            models.Index(fields=['namespace', 'controller_name']),
        ]

    def __str__(self):
        return f"{self.severity} Anomaly - {self.namespace}/{self.controller_name} on {self.metric}"
