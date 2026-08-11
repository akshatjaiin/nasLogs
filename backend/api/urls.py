from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealthCheckView
from incidents.views import IncidentViewSet, DashboardSummaryView, CostBreakdownView, CostHistoryView
from alerts.views import AlertRuleViewSet
from core.views import TestOpenCostConnectionView, ProjectSettingsView, ProjectManagementView
from collector.views import TrafficFlowsView, IngestTelemetryView

router = DefaultRouter()
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'alerts/rules', AlertRuleViewSet, basename='alert-rule')

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('costs/breakdown/', CostBreakdownView.as_view(), name='cost-breakdown'),
    path('costs/history/', CostHistoryView.as_view(), name='cost-history'),
    path('projects/test-connection/', TestOpenCostConnectionView.as_view(), name='test-opencost-connection'),
    path('projects/settings/', ProjectSettingsView.as_view(), name='project-settings'),
    path('projects/all/', ProjectManagementView.as_view(), name='projects-all'),
    path('traffic/flows/', TrafficFlowsView.as_view(), name='traffic-flows'),
    path('collector/v1/ingest/<int:project_id>/', IngestTelemetryView.as_view(), name='ingest-telemetry'),
    path('', include(router.urls)),
]
