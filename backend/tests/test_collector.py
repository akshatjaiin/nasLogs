import pytest
from unittest.mock import patch, MagicMock
from decimal import Decimal
from collector.client import OpenCostClient, OpenCostError
from collector.models import CostSnapshot, WorkloadCost
from collector.tasks import collect_cost_snapshot


class TestOpenCostClient:
    """Tests for the OpenCost API client."""

    def test_parse_valid_response_creates_correct_records(self):
        """TEST 1.1: Valid OpenCost response parses into correct workload dicts."""
        client = OpenCostClient('http://opencost:9003')
        response = {
            'code': 200,
            'data': [
                {
                    'ecommerce/cart-service': {
                        'name': 'ecommerce/cart-service',
                        'networkCost': 1.234567,
                        'networkCrossZoneCost': 0.5,
                        'networkCrossRegionCost': 0.2,
                        'networkInternetCost': 0.534567,
                        'networkEgressBytes': 5368709120,
                    },
                    'media/image-worker': {
                        'name': 'media/image-worker',
                        'networkCost': 82.41,
                        'networkCrossZoneCost': 12.3,
                        'networkCrossRegionCost': 0.0,
                        'networkInternetCost': 70.11,
                        'networkEgressBytes': 107374182400,
                    },
                }
            ]
        }

        results = client.parse_allocation_response(response)

        assert len(results) == 2

        cart = next(r for r in results if r['controller_name'] == 'cart-service')
        assert cart['namespace'] == 'ecommerce'
        assert cart['controller_kind'] == 'deployment'
        assert cart['network_cost'] == 1.234567
        assert cart['egress_bytes'] == 5368709120
        assert cart['cross_zone_cost'] == 0.5
        assert cart['cross_region_cost'] == 0.2
        assert cart['internet_cost'] == 0.534567

        img = next(r for r in results if r['controller_name'] == 'image-worker')
        assert img['namespace'] == 'media'
        assert img['network_cost'] == 82.41
        assert img['egress_bytes'] == 107374182400

    def test_parse_empty_response(self):
        """TEST 1.2: Empty data returns empty list, no crash."""
        client = OpenCostClient('http://opencost:9003')
        response = {'code': 200, 'data': [{}]}

        results = client.parse_allocation_response(response)

        assert results == []

    def test_parse_skips_unallocated(self):
        """Verify __unallocated__ key is skipped."""
        client = OpenCostClient('http://opencost:9003')
        response = {
            'code': 200,
            'data': [
                {
                    '__unallocated__': {'networkCost': 99.99},
                    'app/web': {'networkCost': 1.0, 'networkCrossZoneCost': 0, 'networkCrossRegionCost': 0, 'networkInternetCost': 0, 'networkEgressBytes': 0},
                }
            ]
        }

        results = client.parse_allocation_response(response)
        assert len(results) == 1
        assert results[0]['controller_name'] == 'web'

    @patch('collector.client.requests.get')
    def test_fetch_connection_error_raises_opencost_error(self, mock_get):
        """TEST 1.3: Connection error raises OpenCostError."""
        import requests as req
        mock_get.side_effect = req.ConnectionError('Connection refused')

        client = OpenCostClient('http://opencost:9003')
        with pytest.raises(OpenCostError, match='Failed to fetch allocation'):
            client.fetch_allocation()

    def test_parse_malformed_response_skips_bad_entries(self):
        """TEST 1.5: Keys without slash are handled (namespace='key', controller='unknown')."""
        client = OpenCostClient('http://opencost:9003')
        response = {
            'code': 200,
            'data': [
                {
                    'broken-service': {
                        'name': 'broken-service',
                    }
                }
            ]
        }

        results = client.parse_allocation_response(response)
        # The parser splits by '/' — 'broken-service' has no slash
        # so namespace='broken-service', controller_name='unknown'
        assert len(results) == 1
        assert results[0]['namespace'] == 'broken-service'
        assert results[0]['controller_name'] == 'unknown'
        assert results[0]['network_cost'] == 0  # missing field defaults to 0


class TestCollectCostSnapshot:
    """Tests for the Celery task that collects snapshots."""

    @patch('collector.tasks.OpenCostClient')
    def test_valid_collection_creates_snapshot_and_workloads(self, MockClient, project):
        """TEST 1.1 (integration): Full task creates CostSnapshot + WorkloadCost records."""
        mock_instance = MockClient.return_value
        mock_instance.fetch_allocation.return_value = {
            'code': 200,
            'data': [
                {
                    'ecommerce/cart-service': {
                        'networkCost': 1.234567,
                        'networkCrossZoneCost': 0.5,
                        'networkCrossRegionCost': 0.2,
                        'networkInternetCost': 0.534567,
                        'networkEgressBytes': 5368709120,
                    }
                }
            ]
        }
        mock_instance.parse_allocation_response.return_value = [
            {
                'namespace': 'ecommerce',
                'controller_kind': 'deployment',
                'controller_name': 'cart-service',
                'network_cost': 1.234567,
                'egress_bytes': 5368709120,
                'cross_zone_cost': 0.5,
                'cross_region_cost': 0.2,
                'internet_cost': 0.534567,
            }
        ]

        collect_cost_snapshot(project.id)

        assert CostSnapshot.objects.count() == 1
        assert WorkloadCost.objects.count() == 1

        wc = WorkloadCost.objects.first()
        assert wc.namespace == 'ecommerce'
        assert wc.controller_name == 'cart-service'
        assert float(wc.network_cost_total) == pytest.approx(1.234567)
        assert wc.network_egress_bytes == 5368709120

    @patch('collector.tasks.OpenCostClient')
    def test_opencost_unavailable_no_crash(self, MockClient, project):
        """TEST 1.3: OpenCost down → no snapshot, no crash."""
        mock_instance = MockClient.return_value
        mock_instance.fetch_allocation.side_effect = OpenCostError('Connection refused')

        result = collect_cost_snapshot(project.id)

        assert CostSnapshot.objects.count() == 0
        assert result is None

    def test_nonexistent_project_no_crash(self):
        """Calling with invalid project ID does not crash."""
        result = collect_cost_snapshot(99999)
        assert result is None
