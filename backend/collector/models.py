from django.db import models

class CostSnapshot(models.Model):
    project = models.ForeignKey('core.Project', on_delete=models.CASCADE, related_name='snapshots')
    timestamp = models.DateTimeField()
    window_start = models.DateTimeField()
    window_end = models.DateTimeField()
    raw_response = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [models.Index(fields=['project', '-timestamp'])]

    def __str__(self):
        return f"Snapshot {self.id} for {self.project.name} at {self.timestamp}"

class WorkloadCost(models.Model):
    snapshot = models.ForeignKey(CostSnapshot, on_delete=models.CASCADE, related_name='workload_costs')
    namespace = models.CharField(max_length=255)
    controller_kind = models.CharField(max_length=50, default='deployment')
    controller_name = models.CharField(max_length=255)
    pod = models.CharField(max_length=255, blank=True, default='')
    
    network_cost_total = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    network_egress_bytes = models.BigIntegerField(default=0)
    network_cross_zone_cost = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    network_cross_region_cost = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    network_internet_cost = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    
    class Meta:
        ordering = ['-snapshot__timestamp']
        indexes = [
            models.Index(fields=['namespace', 'controller_name']),
            models.Index(fields=['snapshot']),
        ]

    def __str__(self):
        return f"{self.namespace}/{self.controller_name} - {self.network_cost_total}"
