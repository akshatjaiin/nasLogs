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

        totals = qs.aggregate(
            total_bytes=Sum('network_egress_bytes'),
            total_cost=Sum('network_cost_total'),
            total_czone=Sum('network_cross_zone_cost'),
            total_internet=Sum('network_internet_cost'),
        )

        total_bytes = totals['total_bytes'] or 0
        total_cost = totals['total_cost'] or Decimal('0.00')
        total_czone = totals['total_czone'] or Decimal('0.00')
        total_internet = totals['total_internet'] or Decimal('0.00')

        total_gb = round(total_bytes / (1024 * 1024 * 1024), 2)
        nat_gateway_cost = round(float(total_gb) * self.NAT_GATEWAY_COST_PER_GB, 2)

        # Cross-zone vs Internet vs Direct Breakdown
        czone_gb = round(float(total_czone) / 0.01, 2) if total_czone else 0.0
        internet_gb = round(float(total_internet) / 0.05, 2) if total_internet else 0.0
        same_zone_gb = max(0.0, round(total_gb - czone_gb - internet_gb, 2))

        # Top 5 Talkers by total egress bytes
        top_talkers_qs = qs.values('namespace', 'controller_name', 'controller_kind').annotate(
            egress_bytes=Sum('network_egress_bytes'),
            total_cost=Sum('network_cost_total')
        ).order_by('-egress_bytes')[:5]

        top_talkers = []
        for item in top_talkers_qs:
            gb = round((item['egress_bytes'] or 0) / (1024 * 1024 * 1024), 3)
            top_talkers.append({
                "namespace": item['namespace'],
                "controller_name": item['controller_name'],
                "controller_kind": item['controller_kind'],
                "egress_bytes": item['egress_bytes'] or 0,
                "egress_gb": gb,
                "total_cost": round(float(item['total_cost'] or 0), 2)
            })

        return Response({
            "total_egress_bytes": total_bytes,
            "total_egress_gb": total_gb,
            "total_network_cost": round(float(total_cost), 2),
            "estimated_nat_gateway_cost": nat_gateway_cost,
            "breakdown": {
                "same_zone_gb": same_zone_gb,
                "cross_zone_gb": czone_gb,
                "internet_egress_gb": internet_gb,
            },
            "top_talkers": top_talkers
        })
