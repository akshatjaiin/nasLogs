import pytest
from unittest.mock import patch
from core.models import Project
from collector.tasks import collect_all_active_projects
from detector.tasks import detect_anomalies

@pytest.mark.django_db
class TestPeriodicScheduler:
    
    def test_collect_all_active_projects_triggers_tasks(self, project):
        """Verify periodic scheduler triggers collection for active projects and skips inactive ones."""
        # Create second inactive project
        inactive = Project.objects.create(
            organization=project.organization,
            name="Deprecated Cluster",
            opencost_url="http://opencost:9003",
            api_key="key-inactive-999",
            is_active=False
        )

        with patch('collector.tasks.collect_cost_snapshot.delay') as mock_delay:
            count = collect_all_active_projects()
            
            assert count == 1
            mock_delay.assert_called_once_with(project.id)

    def test_inactive_project_collection_returns_early(self, project):
        """Verify collect_cost_snapshot returns early for inactive projects."""
        project.is_active = False
        project.save()

        with patch('collector.client.OpenCostClient') as MockClient:
            from collector.tasks import collect_cost_snapshot
            result = collect_cost_snapshot(project.id)
            
            assert result is None
            MockClient.assert_not_called()
