import pytest
from decimal import Decimal
from freezegun import freeze_time
from django.utils import timezone
from datetime import timedelta
from correlator.engine import CorrelationEngine
from correlator.models import K8sEvent, Correlation
from detector.models import Anomaly
from collector.models import CostSnapshot, WorkloadCost


def create_anomaly(project, namespace, controller_name, snapshot_timestamp):
    """Helper to create an anomaly with associated snapshot."""
    snapshot = CostSnapshot.objects.create(
        project=project,
        timestamp=snapshot_timestamp,
        window_start=snapshot_timestamp - timedelta(hours=1),
        window_end=snapshot_timestamp,
        raw_response={}
    )
    workload = WorkloadCost.objects.create(
        snapshot=snapshot,
        namespace=namespace,
        controller_kind='deployment',
        controller_name=controller_name,
        network_cost_total=Decimal('6.00'),
    )
    from detector.models import AnomalyThreshold
    threshold = AnomalyThreshold.objects.create(
        project=project, metric='network_cost_total',
        method='pct_change', warning_value=2.0, critical_value=5.0,
    )
    anomaly = Anomaly.objects.create(
        project=project,
        workload_cost=workload,
        threshold=threshold,
        metric='network_cost_total',
        baseline_value=Decimal('1.20'),
        spike_value=Decimal('6.00'),
        deviation_score=4.0,
        severity='warning',
        namespace=namespace,
        controller_name=controller_name,
    )
    return anomaly


@freeze_time('2026-08-11T15:00:00Z')
class TestCorrelationEngine:
    """Tests for the deployment blame/correlation engine."""

    def test_deployment_before_spike_high_confidence(self, project):
        """TEST 3.1: Deployment 5 min before spike → high confidence."""
        spike_time = timezone.now()
        anomaly = create_anomaly(project, 'ecommerce', 'cart-service', spike_time)

        K8sEvent.objects.create(
            project=project,
            timestamp=spike_time - timedelta(minutes=5),
            kind='deployment',
            namespace='ecommerce',
            name='cart-service',
            action='update',
            details={'image': 'cart:v2.1', 'previous_image': 'cart:v2.0'},
        )

        engine = CorrelationEngine()
        correlations = engine.correlate(anomaly)

        assert len(correlations) == 1
        corr = correlations[0]

        # time_score = 1 - (300/1800) = 0.833 → × 0.5 = 0.417
        # namespace_score = 1.0 → × 0.3 = 0.300
        # event_type = 1.0 (deployment) → × 0.2 = 0.200
        # total = 0.917
        assert corr.confidence_score == pytest.approx(0.917, abs=0.01)
        assert corr.time_delta_seconds == -300
        assert 'before' in corr.explanation.lower()

    def test_no_events_empty_correlations(self, project):
        """TEST 3.2: No events near spike → empty correlations."""
        spike_time = timezone.now()
        anomaly = create_anomaly(project, 'ecommerce', 'cart-service', spike_time)

        # No K8sEvents created
        engine = CorrelationEngine()
        correlations = engine.correlate(anomaly)

        assert len(correlations) == 0

    def test_multiple_events_ranked_by_confidence(self, project):
        """TEST 3.3: Multiple events → ranked by confidence score."""
        spike_time = timezone.now()
        anomaly = create_anomaly(project, 'ecommerce', 'cart-service', spike_time)

        # Event 1: deployment in same namespace, 5 min before
        K8sEvent.objects.create(
            project=project,
            timestamp=spike_time - timedelta(minutes=5),
            kind='deployment', namespace='ecommerce',
            name='cart-service', action='update',
        )
        # Event 2: configmap in same namespace, 20 min before
        K8sEvent.objects.create(
            project=project,
            timestamp=spike_time - timedelta(minutes=20),
            kind='configmap', namespace='ecommerce',
            name='cart-config', action='update',
        )
        # Event 3: deployment in DIFFERENT namespace, 2 min before
        K8sEvent.objects.create(
            project=project,
            timestamp=spike_time - timedelta(minutes=2),
            kind='deployment', namespace='payments',
            name='payment-api', action='update',
        )

        engine = CorrelationEngine()
        correlations = engine.correlate(anomaly)

        assert len(correlations) == 3
        # Must be sorted by confidence descending
        scores = [c.confidence_score for c in correlations]
        assert scores == sorted(scores, reverse=True)
        # First should be cart-service deployment (same ns, close time, deployment type)
        assert correlations[0].k8s_event.name == 'cart-service'

    def test_wrong_namespace_lower_confidence(self, project):
        """TEST 3.4: Event in different namespace → lower confidence."""
        spike_time = timezone.now()
        anomaly = create_anomaly(project, 'ecommerce', 'cart-service', spike_time)

        K8sEvent.objects.create(
            project=project,
            timestamp=spike_time - timedelta(minutes=5),
            kind='deployment', namespace='monitoring',  # wrong ns
            name='prometheus', action='update',
        )

        engine = CorrelationEngine()
        correlations = engine.correlate(anomaly)

        assert len(correlations) == 1
        # namespace_score = 0.3 instead of 1.0
        # time_score = 0.833 → × 0.5 = 0.417
        # namespace_score = 0.3 → × 0.3 = 0.090
        # event_type = 1.0 → × 0.2 = 0.200
        # total = 0.707
        assert correlations[0].confidence_score == pytest.approx(0.707, abs=0.01)

    def test_event_after_spike_lower_than_before(self, project):
        """TEST 3.5: Scaling event after spike ranks lower than deployment before."""
        spike_time = timezone.now()
        anomaly = create_anomaly(project, 'ecommerce', 'cart-service', spike_time)

        # Deployment 3 min BEFORE spike
        K8sEvent.objects.create(
            project=project,
            timestamp=spike_time - timedelta(minutes=3),
            kind='deployment', namespace='ecommerce',
            name='cart-service', action='update',
        )
        # HPA scale 5 min AFTER spike
        K8sEvent.objects.create(
            project=project,
            timestamp=spike_time + timedelta(minutes=5),
            kind='hpa', namespace='ecommerce',
            name='cart-service-hpa', action='scale',
        )

        engine = CorrelationEngine()
        correlations = engine.correlate(anomaly)

        assert len(correlations) == 2
        # Deployment before should rank higher
        assert correlations[0].k8s_event.kind == 'deployment'
        assert correlations[0].confidence_score > correlations[1].confidence_score
