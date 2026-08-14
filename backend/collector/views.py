from decimal import Decimal
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from core.models import Project, Organization
from collector.models import CostSnapshot, WorkloadCost
from detector.engine import AnomalyDetector
from incidents.tasks import create_incident
from django.db.models import Sum
import gzip
import json

import logging
logger = logging.getLogger(__name__)

class IngestTelemetryView(APIView):
    """Sentry-Style Telemetry Store Endpoint (POST /api/collector/v1/ingest/<project_id>/)"""
    authentication_classes = []
    permission_classes = []
    throttle_classes = []

    def post(self, request, project_id):
        try:
            # 1. Fetch or initialize target project
            project = Project.objects.filter(id=project_id).first() or Project.objects.first()
            if not project:
                org = Organization.objects.first() or Organization.objects.create(name='Acme Corp', slug='acme-corp')
                project = Project.objects.create(
                    organization=org,
                    name='Production Cluster (AWS)',
                    opencost_url='http://opencost:9003'
                )
                # Auto-create a default anomaly detection threshold
                from detector.models import AnomalyThreshold
                if not project.thresholds.exists():
                    AnomalyThreshold.objects.create(
                        project=project,
                        metric='network_cost_total',
                        method=AnomalyThreshold.Method.PCT_CHANGE,
                        warning_value=2.0,
                        critical_value=5.0,
                        baseline_window_hours=168,
                        min_cost_threshold=0.0100,
                    )

            # 2. DSN Authentication (required)
            api_key = (
                request.headers.get('X-Project-Key') or 
                request.META.get('HTTP_X_PROJECT_KEY') or 
                request.query_params.get('sentry_key')
            )
            if not api_key:
                return Response({"error": "Missing authentication. Provide X-Project-Key header or sentry_key query param."}, status=status.HTTP_401_UNAUTHORIZED)
            if project.api_key != api_key:
                return Response({"error": "Invalid DSN authentication key"}, status=status.HTTP_401_UNAUTHORIZED)

            # 3. Ingest Payload (batch of workload egress metrics)
            # Handle gzip-compressed payloads from SDK clients
            if request.headers.get('Content-Encoding') == 'gzip' or request.META.get('HTTP_CONTENT_ENCODING') == 'gzip':
                try:
                    raw_body = gzip.decompress(request.body)
                    data = json.loads(raw_body.decode('utf-8'))
                except Exception:
                    return Response({"error": "Failed to decompress gzip payload"}, status=400)
            else:
                data = request.data if isinstance(request.data, dict) else {}
            records = data.get('workloads', data.get('records', []))
        
        if not isinstance(records, list):
            return Response({"error": "Invalid payload format. Expected list of workloads"}, status=400)

        now = timezone.now()
        snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=now,
            window_start=now - timezone.timedelta(hours=1),
            window_end=now,
            raw_response={"source": "sdks_ingest", "count": len(records)}
        )

        workload_instances = []
        for r in records:
            ns = r.get('namespace', 'default')
            ctrl = r.get('controller_name', r.get('controller', 'unknown'))
            kind = r.get('controller_kind', 'deployment')
            cost = Decimal(str(r.get('network_cost_total', r.get('cost', 0.0))))
            bytes_transferred = int(r.get('network_egress_bytes', r.get('bytes', 0)))
            czone = Decimal(str(r.get('cross_zone_cost', 0.0)))
            internet = Decimal(str(r.get('internet_cost', 0.0)))

            workload_instances.append(WorkloadCost(
                snapshot=snapshot,
                namespace=ns,
                controller_kind=kind,
                controller_name=ctrl,
                network_cost_total=cost,
                network_egress_bytes=bytes_transferred,
                network_cross_zone_cost=czone,
                network_internet_cost=internet
            ))

        WorkloadCost.objects.bulk_create(workload_instances)

        # 4. Trigger Sentry Anomaly Engine & Correlator
        detector = AnomalyDetector(project)
        anomalies = detector.run_detection(snapshot)
        incidents_created = []

        for anomaly in anomalies:
            res = create_incident(anomaly.id)
            if res is not None:
                inc_id = getattr(res, 'result', res)
                if isinstance(inc_id, (int, str)):
                    incidents_created.append(int(inc_id))

        return Response({
            "status": "success",
            "project": project.name,
            "snapshot_id": snapshot.id,
            "workloads_ingested": len(workload_instances),
            "anomalies_detected": len(anomalies),
            "incidents_created": incidents_created
        }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.exception(f"Unhandled error in IngestTelemetryView: {str(e)}")
            return Response({"error": f"Internal Server Error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TrafficFlowsView(APIView):
    """Aggregated egress traffic flows from real WorkloadCost data, scoped per project."""

    # AWS NAT Gateway pricing: $0.045 per GB processed
    NAT_GATEWAY_COST_PER_GB = 0.045

    def get(self, request):
        project_id = request.query_params.get('project_id')
        qs = WorkloadCost.objects.all()
        if project_id and project_id != 'all':
            qs = qs.filter(snapshot__project_id=project_id)

        total_egress_bytes = qs.aggregate(total=Sum('network_egress_bytes'))['total'] or 0
        total_cross_zone = qs.aggregate(total=Sum('network_cross_zone_cost'))['total'] or 0
        total_internet = qs.aggregate(total=Sum('network_internet_cost'))['total'] or 0

        top_workloads = qs.values('namespace', 'controller_name').annotate(
            total_bytes=Sum('network_egress_bytes'),
            total_cost=Sum('network_cost_total'),
            internet_cost=Sum('network_internet_cost'),
            cross_zone_cost=Sum('network_cross_zone_cost')
        ).order_by('-total_bytes')[:10]

        top_destinations = []
        for item in top_workloads:
            total_bytes = item['total_bytes'] or 0
            gb = round(total_bytes / (1024 ** 3), 2)
            cost = float(item['total_cost'] or 0)
            internet = float(item['internet_cost'] or 0)
            czone = float(item['cross_zone_cost'] or 0)

            if internet > czone:
                traffic_type = "Internet Egress (NAT)"
            elif czone > 0:
                traffic_type = "Cross-AZ"
            else:
                traffic_type = "Intra-AZ"

            top_destinations.append({
                "namespace": item['namespace'],
                "controller": item['controller_name'],
                "bytes_transferred": f"{gb} GB",
                "bytes_raw": total_bytes,
                "cost": round(cost, 2),
                "internet_cost": round(internet, 2),
                "cross_zone_cost": round(czone, 2),
                "traffic_type": traffic_type
            })

        total_egress_gb = round((total_egress_bytes or 0) / (1024 ** 3), 2)
        internet_val = float(total_internet or 0)

        return Response({
            "total_egress_gb": total_egress_gb,
            "cross_zone_cost": round(float(total_cross_zone or 0), 2),
            "internet_cost": round(internet_val, 2),
            "nat_gateway_estimated_cost": round(total_egress_gb * self.NAT_GATEWAY_COST_PER_GB, 2),
            "top_destinations": top_destinations
        })
