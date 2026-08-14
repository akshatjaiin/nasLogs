import sys
from pathlib import Path
BASE_DIR = Path(__file__).resolve().parent
sys.path.append(str(BASE_DIR.parent / 'sdk' / 'python'))

import pytest
from decimal import Decimal
from django.utils import timezone
from datetime import timedelta


@pytest.fixture
def disable_auth(settings):
    """Disable DRF authentication/permission for API tests."""
    settings.REST_FRAMEWORK = {
        'DEFAULT_AUTHENTICATION_CLASSES': [],
        'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.AllowAny'],
        'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
        'PAGE_SIZE': 50,
    }


@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    pass


@pytest.fixture
def org():
    from core.models import Organization
    return Organization.objects.create(name='Acme Corp', slug='acme-corp')


@pytest.fixture
def project(org):
    from core.models import Project
    return Project.objects.create(
        organization=org,
        name='Production Cluster',
        opencost_url='http://opencost:9003',
        api_key='test-api-key-abc123'
    )


@pytest.fixture
def pct_threshold(project):
    from detector.models import AnomalyThreshold
    return AnomalyThreshold.objects.create(
        project=project,
        metric='network_cost_total',
        method='pct_change',
        warning_value=2.0,
        critical_value=5.0,
        baseline_window_hours=168,
        min_cost_threshold=Decimal('0.01'),
    )


@pytest.fixture
def zscore_threshold(project):
    from detector.models import AnomalyThreshold
    return AnomalyThreshold.objects.create(
        project=project,
        metric='network_cost_total',
        method='zscore',
        warning_value=2.0,
        critical_value=3.0,
        baseline_window_hours=168,
        min_cost_threshold=Decimal('0.01'),
    )


def create_baseline_snapshots(project, namespace, controller_name, values, hours_ago_start=168, offset_ms=0):
    """Helper to create historical cost snapshots for baseline.
    
    offset_ms: microsecond offset to avoid unique constraint violations
    when creating multiple baselines in frozen time.
    """
    from collector.models import CostSnapshot, WorkloadCost
    snapshots = []
    base_offset = timedelta(microseconds=offset_ms)
    for i, value in enumerate(values):
        ts = timezone.now() - timedelta(hours=hours_ago_start - i) + base_offset
        snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=ts,
            window_start=ts - timedelta(hours=1),
            window_end=ts,
            raw_response={}
        )
        WorkloadCost.objects.create(
            snapshot=snapshot,
            namespace=namespace,
            controller_kind='deployment',
            controller_name=controller_name,
            network_cost_total=Decimal(str(value)),
            network_egress_bytes=int(value * 1073741824),
        )
        snapshots.append(snapshot)
    return snapshots
