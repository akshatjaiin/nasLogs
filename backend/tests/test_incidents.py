import pytest
from decimal import Decimal
from freezegun import freeze_time
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from incidents.models import Incident
from incidents.tasks import create_incident
from detector.models import Anomaly, AnomalyThreshold
from collector.models import CostSnapshot, WorkloadCost
from correlator.models import K8sEvent, Correlation


_make_anomaly_counter = 0

def make_anomaly(project, namespace='ecommerce', controller='cart-service', severity='warning'):
    """Helper to create an anomaly with all required related objects."""
    global _make_anomaly_counter
    _make_anomaly_counter += 1
    offset = timedelta(seconds=_make_anomaly_counter)
    threshold = AnomalyThreshold.objects.create(
        project=project, metric='network_cost_total',
        method='pct_change', warning_value=2.0, critical_value=5.0,
    )
    snapshot = CostSnapshot.objects.create(
        project=project,
        timestamp=timezone.now() + offset,
        window_start=timezone.now() - timedelta(hours=1) + offset,
        window_end=timezone.now() + offset,
        raw_response={}
    )
    workload = WorkloadCost.objects.create(
        snapshot=snapshot,
        namespace=namespace,
        controller_kind='deployment',
        controller_name=controller,
        network_cost_total=Decimal('4.80'),
    )
    anomaly = Anomaly.objects.create(
        project=project,
        workload_cost=workload,
        threshold=threshold,
        metric='network_cost_total',
        baseline_value=Decimal('1.20'),
        spike_value=Decimal('4.80'),
        deviation_score=3.0,
        severity=severity,
        namespace=namespace,
        controller_name=controller,
    )
    return anomaly


@freeze_time('2026-08-11T15:00:00Z')
class TestCreateIncident:
    """Tests for incident creation from anomalies."""

    def test_anomaly_creates_incident_with_evidence(self, project):
        """TEST 4.1: Anomaly + correlation → full incident with evidence JSON."""
        anomaly = make_anomaly(project)

        # Add a correlation
        event = K8sEvent.objects.create(
            project=project,
            timestamp=timezone.now() - timedelta(minutes=5),
            kind='deployment', namespace='ecommerce',
            name='cart-service', action='update',
            details={'image': 'cart:v2.1'},
        )
        Correlation.objects.create(
            anomaly=anomaly, k8s_event=event,
            time_delta_seconds=-300, confidence_score=0.92,
            explanation='Deployment updated 5 min before spike',
        )

        incident_id = create_incident(anomaly.id)

        incident = Incident.objects.get(id=incident_id)
        assert incident.status == 'open'
        assert incident.severity == 'warning'
        assert 'ecommerce' in incident.title
        assert 'cart-service' in incident.title
        assert incident.fingerprint == f"{project.id}:ecommerce:cart-service:network_cost_total"

        # Verify evidence structure
        ev = incident.evidence
        assert ev['anomaly']['metric'] == 'network_cost_total'
        assert ev['anomaly']['baseline'] == pytest.approx(1.20)
        assert ev['anomaly']['spike'] == pytest.approx(4.80)
        assert ev['workload']['namespace'] == 'ecommerce'
        assert ev['workload']['controller'] == 'cart-service'
        assert len(ev['correlations']) == 1
        assert ev['correlations'][0]['confidence'] == 0.92

    def test_duplicate_fingerprint_no_second_incident(self, project):
        """TEST 4.2: Same fingerprint → no duplicate incident."""
        anomaly1 = make_anomaly(project, 'ecommerce', 'cart-service')
        incident_id_1 = create_incident(anomaly1.id)

        # Create second anomaly for same workload
        anomaly2 = make_anomaly(project, 'ecommerce', 'cart-service')
        incident_id_2 = create_incident(anomaly2.id)

        # Should return existing incident, not create new
        assert incident_id_1 == incident_id_2
        assert Incident.objects.count() == 1

    def test_resolved_incident_allows_new_one(self, project):
        """Resolved incident allows new incident for same fingerprint."""
        anomaly1 = make_anomaly(project)
        incident_id_1 = create_incident(anomaly1.id)

        # Resolve the first incident
        incident = Incident.objects.get(id=incident_id_1)
        incident.status = Incident.Status.RESOLVED
        incident.save()

        # New anomaly should create new incident
        anomaly2 = make_anomaly(project)
        incident_id_2 = create_incident(anomaly2.id)

        assert incident_id_1 != incident_id_2
        assert Incident.objects.count() == 2


@freeze_time('2026-08-11T15:00:00Z')
class TestIncidentAPI:
    """Tests for the incidents REST API."""

    @pytest.fixture(autouse=True)
    def setup_client(self):
        """Create an authenticated API client."""
        from django.contrib.auth.models import User
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_incident_list(self, project):
        """GET /api/incidents/ returns incidents."""
        anomaly = make_anomaly(project)
        create_incident(anomaly.id)

        response = self.client.get('/api/incidents/')

        assert response.status_code == 200
        assert response.data['count'] == 1
        assert 'cart-service' in response.data['results'][0]['title']

    def test_incident_detail_returns_evidence(self, project):
        """GET /api/incidents/{id}/ returns full evidence."""
        anomaly = make_anomaly(project)
        incident_id = create_incident(anomaly.id)

        response = self.client.get(f'/api/incidents/{incident_id}/')

        assert response.status_code == 200
        assert 'evidence' in response.data
        assert response.data['evidence']['anomaly']['metric'] == 'network_cost_total'

    def test_incident_status_transition(self, project):
        """PATCH /api/incidents/{id}/ can update status."""
        anomaly = make_anomaly(project)
        incident_id = create_incident(anomaly.id)

        # Acknowledge
        response = self.client.patch(
            f'/api/incidents/{incident_id}/',
            {'status': 'acknowledged'},
            format='json'
        )
        assert response.status_code == 200
        assert response.data['status'] == 'acknowledged'

    def test_incident_filter_by_status(self, project):
        """GET /api/incidents/?status=open filters correctly."""
        anomaly1 = make_anomaly(project, 'ns1', 'svc1')
        create_incident(anomaly1.id)

        anomaly2 = make_anomaly(project, 'ns2', 'svc2')
        inc2_id = create_incident(anomaly2.id)
        Incident.objects.filter(id=inc2_id).update(status='resolved')

        response = self.client.get('/api/incidents/?status=open')

        assert response.status_code == 200
        assert response.data['count'] == 1

    def test_health_endpoint_no_auth(self):
        """TEST 7.4: Health endpoint requires no auth."""
        unauth_client = APIClient()  # no force_authenticate
        response = unauth_client.get('/api/health/')

        assert response.status_code == 200
        assert response.data['status'] == 'ok'
        assert response.data['version'] == '0.1.0'

    def test_dashboard_summary(self, project):
        """GET /api/dashboard/summary/ returns correct counts."""
        # Create 2 open incidents (1 critical, 1 warning)
        anomaly1 = make_anomaly(project, 'ns1', 'svc1', severity='critical')
        create_incident(anomaly1.id)
        anomaly2 = make_anomaly(project, 'ns2', 'svc2', severity='warning')
        create_incident(anomaly2.id)

        response = self.client.get('/api/dashboard/summary/')

        assert response.status_code == 200
        assert response.data['open_incidents_count'] == 2
        assert response.data['critical_count'] == 1

