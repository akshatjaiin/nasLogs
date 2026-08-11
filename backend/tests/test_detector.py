import pytest
from decimal import Decimal
from freezegun import freeze_time
from django.utils import timezone
from datetime import timedelta
from detector.engine import AnomalyDetector
from detector.models import Anomaly, AnomalyThreshold
from collector.models import CostSnapshot, WorkloadCost
from conftest import create_baseline_snapshots
import random


@freeze_time('2026-08-11T15:00:00Z')
class TestPctChangeDetection:
    """Tests for percentage-change based anomaly detection."""

    def test_normal_cost_no_anomaly(self, project, pct_threshold):
        """TEST 2.1: Cost within normal range → no anomaly."""
        # Baseline: 168 hours at ~$1.20
        baseline_values = [1.20] * 168
        create_baseline_snapshots(project, 'ecommerce', 'cart-service', baseline_values)

        # Current: $1.35 (11.6% above mean — well below 200% threshold)
        current_snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timedelta(hours=1),
            window_end=timezone.now(),
            raw_response={}
        )
        WorkloadCost.objects.create(
            snapshot=current_snapshot,
            namespace='ecommerce',
            controller_kind='deployment',
            controller_name='cart-service',
            network_cost_total=Decimal('1.35'),
        )

        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(current_snapshot)

        assert len(anomalies) == 0

    def test_300pct_spike_triggers_warning(self, project, pct_threshold):
        """TEST 2.2: 300% spike → WARNING severity."""
        create_baseline_snapshots(project, 'ecommerce', 'cart-service', [1.20] * 168)

        current_snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timedelta(hours=1),
            window_end=timezone.now(),
            raw_response={}
        )
        WorkloadCost.objects.create(
            snapshot=current_snapshot,
            namespace='ecommerce',
            controller_kind='deployment',
            controller_name='cart-service',
            network_cost_total=Decimal('4.80'),  # 4x = 300% increase
        )

        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(current_snapshot)

        assert len(anomalies) == 1
        anomaly = anomalies[0]
        assert anomaly.severity == 'warning'
        assert float(anomaly.baseline_value) == pytest.approx(1.20, abs=0.1)  # baseline includes current snapshot
        assert float(anomaly.spike_value) == pytest.approx(4.80)
        assert anomaly.deviation_score > 2.0  # above warning threshold
        assert anomaly.namespace == 'ecommerce'
        assert anomaly.controller_name == 'cart-service'

    def test_600pct_spike_triggers_critical(self, project, pct_threshold):
        """TEST 2.3: 600% spike → CRITICAL severity."""
        create_baseline_snapshots(project, 'ecommerce', 'cart-service', [1.20] * 168)

        current_snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timedelta(hours=1),
            window_end=timezone.now(),
            raw_response={}
        )
        WorkloadCost.objects.create(
            snapshot=current_snapshot,
            namespace='ecommerce',
            controller_kind='deployment',
            controller_name='cart-service',
            network_cost_total=Decimal('8.40'),  # 7x = 600%
        )

        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(current_snapshot)

        assert len(anomalies) == 1
        assert anomalies[0].severity == 'critical'
        assert anomalies[0].deviation_score > 5.0  # above critical threshold

    def test_gradual_growth_not_anomaly(self, project, pct_threshold):
        """TEST 2.4: Gradual 2%/day growth is NOT an anomaly."""
        # Cost grows from $1.00 to ~$1.14 over 7 days
        values = []
        for day in range(7):
            daily_val = 1.00 * (1.02 ** day)
            values.extend([daily_val] * 24)  # 24 hours per day

        create_baseline_snapshots(project, 'ecommerce', 'cart-service', values)

        current_snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timedelta(hours=1),
            window_end=timezone.now(),
            raw_response={}
        )
        WorkloadCost.objects.create(
            snapshot=current_snapshot,
            namespace='ecommerce',
            controller_kind='deployment',
            controller_name='cart-service',
            network_cost_total=Decimal('1.16'),  # continues trend
        )

        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(current_snapshot)

        assert len(anomalies) == 0

    def test_zero_baseline_sudden_cost_is_critical(self, project, pct_threshold):
        """TEST 2.5: Zero-cost workload suddenly active → CRITICAL."""
        create_baseline_snapshots(project, 'batch', 'data-pipeline', [0.0] * 168)

        current_snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timedelta(hours=1),
            window_end=timezone.now(),
            raw_response={}
        )
        WorkloadCost.objects.create(
            snapshot=current_snapshot,
            namespace='batch',
            controller_kind='deployment',
            controller_name='data-pipeline',
            network_cost_total=Decimal('5.50'),
        )

        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(current_snapshot)

        assert len(anomalies) == 1
        assert anomalies[0].severity == 'critical'
        assert float(anomalies[0].baseline_value) < 0.1  # near zero (includes current snapshot in avg)
        assert float(anomalies[0].spike_value) == pytest.approx(5.50)

    def test_below_min_threshold_ignored(self, project, pct_threshold):
        """TEST 2.8: Tiny cost below $0.01 min threshold is ignored even with huge % change."""
        create_baseline_snapshots(project, 'tiny', 'micro-svc', [0.001] * 168)

        current_snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timedelta(hours=1),
            window_end=timezone.now(),
            raw_response={}
        )
        WorkloadCost.objects.create(
            snapshot=current_snapshot,
            namespace='tiny',
            controller_kind='deployment',
            controller_name='micro-svc',
            network_cost_total=Decimal('0.005'),  # 400% increase but below $0.01
        )

        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(current_snapshot)

        assert len(anomalies) == 0


@freeze_time('2026-08-11T15:00:00Z')
class TestZScoreDetection:
    """Tests for z-score based anomaly detection."""

    def test_zscore_variable_baseline_spike(self, project, zscore_threshold):
        """TEST 2.6: Z-score on variable baseline correctly detects outlier."""
        random.seed(42)
        values = [random.uniform(0.50, 3.00) for _ in range(168)]
        create_baseline_snapshots(project, 'api', 'gateway', values)

        current_snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timedelta(hours=1),
            window_end=timezone.now(),
            raw_response={}
        )
        WorkloadCost.objects.create(
            snapshot=current_snapshot,
            namespace='api',
            controller_kind='deployment',
            controller_name='gateway',
            network_cost_total=Decimal('5.50'),  # well above normal variation
        )

        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(current_snapshot)

        assert len(anomalies) == 1
        assert anomalies[0].severity == 'critical'  # z > 3.0
        assert anomalies[0].deviation_score > 3.0  # z-score above critical threshold


@freeze_time('2026-08-11T15:00:00Z')
class TestMultiWorkloadDetection:
    """Tests for detection across multiple workloads."""

    def test_multiple_workloads_independent_anomalies(self, project, pct_threshold):
        """TEST 2.7: Multiple workloads spike → separate anomalies per workload."""
        # cart-service: baseline $1.20
        create_baseline_snapshots(project, 'ecommerce', 'cart-service', [1.20] * 168, offset_ms=0)
        # image-worker: baseline $80.00
        create_baseline_snapshots(project, 'media', 'image-worker', [80.00] * 168, offset_ms=100)
        # payment-api: baseline $0.50
        create_baseline_snapshots(project, 'payments', 'payment-api', [0.50] * 168, offset_ms=200)

        current_snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timedelta(hours=1),
            window_end=timezone.now(),
            raw_response={}
        )

        # cart-service: $6.00 (400% spike → WARNING)
        WorkloadCost.objects.create(
            snapshot=current_snapshot, namespace='ecommerce',
            controller_name='cart-service', controller_kind='deployment',
            network_cost_total=Decimal('6.00'),
        )
        # image-worker: $82.00 (2.5% increase → NORMAL)
        WorkloadCost.objects.create(
            snapshot=current_snapshot, namespace='media',
            controller_name='image-worker', controller_kind='deployment',
            network_cost_total=Decimal('82.00'),
        )
        # payment-api: $4.00 (700% spike → CRITICAL)
        WorkloadCost.objects.create(
            snapshot=current_snapshot, namespace='payments',
            controller_name='payment-api', controller_kind='deployment',
            network_cost_total=Decimal('4.00'),
        )

        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(current_snapshot)

        assert len(anomalies) == 2

        namespaces = {a.controller_name for a in anomalies}
        assert 'cart-service' in namespaces
        assert 'payment-api' in namespaces
        assert 'image-worker' not in namespaces

        payment_anomaly = next(a for a in anomalies if a.controller_name == 'payment-api')
        assert payment_anomaly.severity == 'critical'  # 700% > 500%

        cart_anomaly = next(a for a in anomalies if a.controller_name == 'cart-service')
        assert cart_anomaly.severity == 'warning'  # 400% > 200% but < 500%
