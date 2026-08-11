import pytest
from decimal import Decimal
from unittest.mock import patch, MagicMock
from freezegun import freeze_time
from django.utils import timezone
from datetime import timedelta
from alerts.models import AlertRule, AlertHistory
from alerts.backends import SlackBackend
from alerts.tasks import send_incident_alerts
from incidents.models import Incident
from incidents.tasks import create_incident
from detector.models import Anomaly, AnomalyThreshold
from collector.models import CostSnapshot, WorkloadCost


_make_incident_counter = 0

def make_incident(project, namespace='media', controller='image-worker', severity='critical'):
    """Helper: creates anomaly → incident, returns incident."""
    global _make_incident_counter
    _make_incident_counter += 1
    offset = timedelta(seconds=_make_incident_counter)
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
        snapshot=snapshot, namespace=namespace,
        controller_kind='deployment', controller_name=controller,
        network_cost_total=Decimal('560.00'),
    )
    anomaly = Anomaly.objects.create(
        project=project, workload_cost=workload, threshold=threshold,
        metric='network_cost_total',
        baseline_value=Decimal('80.00'), spike_value=Decimal('560.00'),
        deviation_score=6.0, severity=severity,
        namespace=namespace, controller_name=controller,
    )
    incident_id = create_incident(anomaly.id)
    return Incident.objects.get(id=incident_id)


@freeze_time('2026-08-11T15:00:00Z')
class TestSlackBackend:
    """Tests for the Slack webhook backend."""

    @patch('alerts.backends.requests.post')
    def test_successful_send(self, mock_post, project):
        """TEST 5.1: Slack webhook sends correct payload format."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = 'ok'
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        incident = make_incident(project)

        success, response = SlackBackend.send('https://hooks.slack.com/test', incident)

        assert success is True
        assert response == 'ok'

        # Verify the POST was called with blocks
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        payload = call_kwargs.kwargs.get('json') or call_kwargs[1].get('json')
        assert 'blocks' in payload
        assert len(payload['blocks']) >= 2  # header + section

    @patch('alerts.backends.requests.post')
    def test_webhook_failure_returns_false(self, mock_post, project):
        """TEST 5.4: Webhook failure → returns (False, error message)."""
        mock_post.side_effect = Exception('Connection refused')

        incident = make_incident(project)
        success, response = SlackBackend.send('https://hooks.slack.com/invalid', incident)

        assert success is False
        assert 'Connection refused' in response


@freeze_time('2026-08-11T15:00:00Z')
class TestSendIncidentAlerts:
    """Tests for the alert delivery task."""

    @patch('alerts.backends.requests.post')
    def test_sends_to_matching_slack_rule(self, mock_post, project):
        """Active Slack rule → sends alert, creates AlertHistory(sent)."""
        mock_response = MagicMock()
        mock_response.text = 'ok'
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        AlertRule.objects.create(
            project=project, name='Slack Alerts',
            channel_type='slack',
            channel_config={'webhook_url': 'https://hooks.slack.com/test'},
            is_active=True,
        )

        incident = make_incident(project)
        send_incident_alerts(incident.id)

        assert AlertHistory.objects.count() == 1
        history = AlertHistory.objects.first()
        assert history.status == 'sent'
        assert history.incident == incident

    def test_disabled_rule_no_send(self, project):
        """TEST 5.2: Disabled alert rule → no delivery."""
        AlertRule.objects.create(
            project=project, name='Disabled Slack',
            channel_type='slack',
            channel_config={'webhook_url': 'https://hooks.slack.com/test'},
            is_active=False,
        )

        incident = make_incident(project)
        send_incident_alerts(incident.id)

        assert AlertHistory.objects.count() == 0

    def test_severity_filter_skips_non_matching(self, project):
        """TEST 5.3: Severity filter 'critical' skips 'warning' incidents."""
        AlertRule.objects.create(
            project=project, name='Critical Only',
            channel_type='slack',
            channel_config={'webhook_url': 'https://hooks.slack.com/test'},
            severity_filter='critical',
            is_active=True,
        )

        # Create a WARNING incident
        incident = make_incident(project, severity='warning')
        send_incident_alerts(incident.id)

        assert AlertHistory.objects.count() == 0

    @patch('alerts.backends.requests.post')
    def test_delivery_failure_logged(self, mock_post, project):
        """TEST 5.4: Delivery failure → AlertHistory with status='failed'."""
        mock_post.side_effect = Exception('404 not found')

        AlertRule.objects.create(
            project=project, name='Broken Slack',
            channel_type='slack',
            channel_config={'webhook_url': 'https://hooks.slack.com/invalid'},
            is_active=True,
        )

        incident = make_incident(project)
        send_incident_alerts(incident.id)

        assert AlertHistory.objects.count() == 1
        history = AlertHistory.objects.first()
        assert history.status == 'failed'
        assert '404' in history.response_body or 'not found' in history.response_body
