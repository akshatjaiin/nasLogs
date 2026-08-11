from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count
from .models import Incident
from .serializers import IncidentSerializer

class IncidentViewSet(viewsets.ModelViewSet):
    serializer_class = IncidentSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        qs = Incident.objects.all()
        status = self.request.query_params.get('status')
        severity = self.request.query_params.get('severity')
        
        if status:
            qs = qs.filter(status=status)
        if severity:
            qs = qs.filter(severity=severity)
            
        return qs

class DashboardSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        open_count = Incident.objects.filter(status=Incident.Status.OPEN).count()
        critical_count = Incident.objects.filter(status=Incident.Status.OPEN, severity='critical').count()
        
        recent = Incident.objects.filter(status=Incident.Status.OPEN).order_by('-created_at')[:5]
        recent_data = IncidentSerializer(recent, many=True).data
        
        return Response({
            "open_incidents_count": open_count,
            "critical_count": critical_count,
            "top_cost_movers": [],
            "recent_incidents": recent_data
        })
