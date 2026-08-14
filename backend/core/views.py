import secrets
import time
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.models import Project, Organization
from detector.models import AnomalyThreshold

class TestOpenCostConnectionView(APIView):

    def post(self, request):
        """Pings OpenCost API endpoint and measures latency in milliseconds."""
        url = request.data.get('url', 'http://opencost.monitoring.svc:9003')
        if not url.startswith('http://') and not url.startswith('https://'):
            url = 'http://' + url
            
        test_endpoint = f"{url.rstrip('/')}/allocation/compute"
        
        try:
            start = time.time()
            resp = requests.get(test_endpoint, params={'window': '1h'}, timeout=4)
            latency_ms = int((time.time() - start) * 1000)
            
            if resp.status_code == 200:
                return Response({
                    "status": "connected",
                    "latency_ms": latency_ms,
                    "message": f"Successfully reached OpenCost API v1.108 ({latency_ms}ms)",
                    "url": url
                })
            else:
                return Response({
                    "status": "warning",
                    "latency_ms": latency_ms,
                    "message": f"OpenCost responded with HTTP {resp.status_code}",
                    "url": url
                })
        except requests.exceptions.ConnectionError:
            return Response({
                "status": "failed",
                "message": f"Connection refused. Could not reach OpenCost at {url}. Ensure the service is running and accessible.",
                "url": url
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({
                "status": "failed",
                "message": f"Failed to reach OpenCost: {str(e)}",
                "url": url
            }, status=status.HTTP_400_BAD_REQUEST)

class ProjectSettingsView(APIView):

    def get(self, request):
        project_id = request.query_params.get('project_id', '1')
        try:
            project = Project.objects.get(id=project_id)
            threshold = AnomalyThreshold.objects.filter(project=project).first()
            return Response({
                "id": project.id,
                "name": project.name,
                "opencost_url": project.opencost_url,
                "k8s_context": project.k8s_context,
                "api_key": project.api_key,
                "dsn": f"http://{project.api_key}@localhost:8000/api/collector/v1/ingest/{project.id}",
                "retention_days": getattr(project, 'retention_days', 30),
                "baseline_window_hours": getattr(project, 'baseline_window_hours', 168),
                "min_cost_threshold": float(getattr(project, 'min_cost_threshold', 0.01)),
                "warning_pct": threshold.warning_value * 100 if threshold else 200,
                "critical_pct": threshold.critical_value * 100 if threshold else 500,
            })
        except Project.DoesNotExist:
            return Response({"error": "Project not found"}, status=404)

    def patch(self, request):
        project_id = request.data.get('project_id', '1')
        try:
            project = Project.objects.get(id=project_id)
            if 'name' in request.data:
                project.name = request.data['name']
            if 'opencost_url' in request.data:
                project.opencost_url = request.data['opencost_url']
            if 'k8s_context' in request.data:
                project.k8s_context = request.data['k8s_context']
            if 'retention_days' in request.data:
                project.retention_days = int(request.data['retention_days'])
            if 'baseline_window_hours' in request.data:
                project.baseline_window_hours = int(request.data['baseline_window_hours'])
            if 'min_cost_threshold' in request.data:
                project.min_cost_threshold = float(request.data['min_cost_threshold'])
            project.save()

            threshold = AnomalyThreshold.objects.filter(project=project).first()
            if threshold:
                if 'warning_pct' in request.data:
                    threshold.warning_value = float(request.data['warning_pct']) / 100.0
                if 'critical_pct' in request.data:
                    threshold.critical_value = float(request.data['critical_pct']) / 100.0
                if 'baseline_window_hours' in request.data:
                    threshold.baseline_window_hours = int(request.data['baseline_window_hours'])
                threshold.save()

            return Response({"status": "updated", "message": "Project settings updated successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=400)


class ProjectManagementView(APIView):
    """List & Create Projects for Multi-Cluster Management."""

    def get(self, request):
        projects = Project.objects.all()
        data = [{
            "id": p.id,
            "name": p.name,
            "opencost_url": p.opencost_url,
            "k8s_context": p.k8s_context,
            "api_key": p.api_key,
            "created_at": p.created_at.strftime('%Y-%m-%d %H:%M')
        } for p in projects]
        return Response({"projects": data})

    def post(self, request):
        name = request.data.get('name')
        opencost_url = request.data.get('opencost_url', 'http://opencost:9003')
        k8s_context = request.data.get('k8s_context', '')
        
        if not name:
            return Response({"error": "Project name required"}, status=400)

        org = Organization.objects.first()
        if not org:
            org = Organization.objects.create(name='Acme Corp', slug='acme-corp')

        project = Project.objects.create(
            organization=org,
            name=name,
            opencost_url=opencost_url,
            k8s_context=k8s_context,
            api_key=secrets.token_hex(32)
        )
        
        # Auto-create a default anomaly detection threshold for the new project
        AnomalyThreshold.objects.create(
            project=project,
            metric='network_cost_total',
            method=AnomalyThreshold.Method.PCT_CHANGE,
            warning_value=2.0,
            critical_value=5.0,
            baseline_window_hours=168,
            min_cost_threshold=0.0100,
        )
        
        return Response({
            "status": "created",
            "project": {
                "id": project.id,
                "name": project.name,
                "api_key": project.api_key
            }
        })
