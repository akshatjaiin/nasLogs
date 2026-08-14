import math
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta
from collector.models import WorkloadCost
from .models import Anomaly

class AnomalyDetector:
    def __init__(self, project):
        self.project = project

    def get_baseline(self, namespace, controller_name, metric, window_hours):
        since = timezone.now() - timedelta(hours=window_hours)
        qs = WorkloadCost.objects.filter(
            snapshot__project=self.project,
            snapshot__timestamp__gte=since,
            namespace=namespace,
            controller_name=controller_name
        ).values_list(metric, flat=True)
        return list(qs)

    def detect_pct_change(self, current_value, baseline_values, warning_threshold, critical_threshold, min_threshold):
        if not baseline_values:
            return False, '', 0.0
            
        current = float(current_value)
        if current < float(min_threshold):
            return False, '', 0.0
            
        mean = sum(float(v) for v in baseline_values) / len(baseline_values)
        
        if mean == 0:
            if current > float(min_threshold):
                return True, Anomaly.Severity.CRITICAL, 9999.0
            return False, '', 0.0
            
        pct_change = (current - mean) / mean
        
        if pct_change >= critical_threshold:
            return True, Anomaly.Severity.CRITICAL, pct_change
        elif pct_change >= warning_threshold:
            return True, Anomaly.Severity.WARNING, pct_change
            
        return False, '', pct_change

    def detect_zscore(self, current_value, baseline_values, warning_threshold, critical_threshold, min_threshold):
        if not baseline_values or len(baseline_values) < 2:
            return self.detect_pct_change(current_value, baseline_values, warning_threshold, critical_threshold, min_threshold)
            
        current = float(current_value)
        if current < float(min_threshold):
            return False, '', 0.0
            
        mean = sum(float(v) for v in baseline_values) / len(baseline_values)
        variance = sum((float(v) - mean) ** 2 for v in baseline_values) / (len(baseline_values) - 1)
        std_dev = math.sqrt(variance)
        
        if std_dev == 0:
            return self.detect_pct_change(current_value, baseline_values, warning_threshold, critical_threshold, min_threshold)
            
        z = (current - mean) / std_dev
        
        if z >= critical_threshold:
            return True, Anomaly.Severity.CRITICAL, z
        elif z >= warning_threshold:
            return True, Anomaly.Severity.WARNING, z
            
        return False, '', z

    def run_detection(self, snapshot):
        anomalies = []
        active_thresholds = list(self.project.thresholds.filter(is_active=True))
        
        for workload in snapshot.workload_costs.all():
            for threshold in active_thresholds:
                current_value = getattr(workload, threshold.metric)
                baseline_values = self.get_baseline(
                    workload.namespace, 
                    workload.controller_name, 
                    threshold.metric, 
                    threshold.baseline_window_hours
                )
                
                mean_val = sum(baseline_values) / len(baseline_values) if baseline_values else Decimal(0)
                
                if threshold.method == threshold.Method.PCT_CHANGE:
                    is_anomaly, severity, score = self.detect_pct_change(
                        current_value, baseline_values, 
                        threshold.warning_value, threshold.critical_value, threshold.min_cost_threshold
                    )
                else:
                    is_anomaly, severity, score = self.detect_zscore(
                        current_value, baseline_values, 
                        threshold.warning_value, threshold.critical_value, threshold.min_cost_threshold
                    )
                    
                if is_anomaly:
                    anomalies.append(Anomaly(
                        project=self.project,
                        workload_cost=workload,
                        threshold=threshold,
                        metric=threshold.metric,
                        baseline_value=mean_val,
                        spike_value=current_value,
                        deviation_score=score,
                        severity=severity,
                        namespace=workload.namespace,
                        controller_name=workload.controller_name
                    ))
                    
        return Anomaly.objects.bulk_create(anomalies)
