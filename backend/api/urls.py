from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealthCheckView
from incidents.views import IncidentViewSet, DashboardSummaryView

router = DefaultRouter()
router.register(r'incidents', IncidentViewSet, basename='incident')

urlpatterns = [
    path('health/', HealthCheckView.as_view(), name='health-check'),
    path('dashboard/summary/', DashboardSummaryView.as_view(), name='dashboard-summary'),
    path('', include(router.urls)),
]
