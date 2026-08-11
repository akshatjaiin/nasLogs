from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealthCheckView
from incidents.views import IncidentViewSet, DashboardSummaryView, CostBreakdownView, CostHistoryView

router = DefaultRouter()
router.register(r'incidents', IncidentViewSet, basename='incident')

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('costs/breakdown/', CostBreakdownView.as_view(), name='cost-breakdown'),
    path('costs/history/', CostHistoryView.as_view(), name='cost-history'),
    path('', include(router.urls)),
]
