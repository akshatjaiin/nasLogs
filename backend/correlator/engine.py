from datetime import timedelta
from django.utils import timezone
from .models import K8sEvent, Correlation

class CorrelationEngine:
    CORRELATION_WINDOW_SECONDS = 1800
    TIME_WEIGHT = 0.5
    NAMESPACE_WEIGHT = 0.3
    EVENT_TYPE_WEIGHT = 0.2
    
    EVENT_TYPE_SCORES = {
        'deployment': 1.0, 
        'replicaset': 0.8, 
        'statefulset': 0.9, 
        'configmap': 0.6, 
        'hpa': 0.7
    }

    def find_candidates(self, anomaly):
        window_start = anomaly.workload_cost.snapshot.timestamp - timedelta(seconds=self.CORRELATION_WINDOW_SECONDS)
        window_end = anomaly.workload_cost.snapshot.timestamp + timedelta(seconds=self.CORRELATION_WINDOW_SECONDS)
        
        return K8sEvent.objects.filter(
            project=anomaly.project,
            timestamp__gte=window_start,
            timestamp__lte=window_end
        )

    def score_candidate(self, anomaly, event):
        delta = (event.timestamp - anomaly.workload_cost.snapshot.timestamp).total_seconds()
        
        time_score = max(0.0, 1.0 - (abs(delta) / self.CORRELATION_WINDOW_SECONDS))
        namespace_score = 1.0 if event.namespace == anomaly.namespace else 0.3
        event_type_score = self.EVENT_TYPE_SCORES.get(event.kind.lower(), 0.5)
        
        total_score = (
            time_score * self.TIME_WEIGHT +
            namespace_score * self.NAMESPACE_WEIGHT +
            event_type_score * self.EVENT_TYPE_WEIGHT
        )
        
        explanation = f"{event.action.capitalize()} {event.kind} '{event.name}' in namespace '{event.namespace}' {abs(int(delta))}s {'before' if delta < 0 else 'after'} the cost spike."
        
        return total_score, explanation, delta

    def correlate(self, anomaly):
        candidates = self.find_candidates(anomaly)
        correlations = []
        
        scored = []
        for event in candidates:
            score, explanation, delta = self.score_candidate(anomaly, event)
            if score > 0.3:
                scored.append((score, explanation, delta, event))
                
        scored.sort(key=lambda x: x[0], reverse=True)
        top_candidates = scored[:3]
        
        for score, explanation, delta, event in top_candidates:
            correlations.append(Correlation(
                anomaly=anomaly,
                k8s_event=event,
                time_delta_seconds=int(delta),
                confidence_score=score,
                explanation=explanation
            ))
            
        return Correlation.objects.bulk_create(correlations)
