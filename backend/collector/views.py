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

class IngestTelemetryView(APIView):
    """Sentry-Style Telemetry Store Endpoint (POST /api/collector/v1/ingest/<project_id>/)"""
    authentication_classes = []
    permission_classes = []

    def post(self, request, project_id):
        # 1. Fetch or initialize target project
        project = Project.objects.filter(id=project_id).first() or Project.objects.first()
        if not project:
            org = Organization.objects.first() or Organization.objects.create(name='Acme Corp', slug='acme-corp')
            project = Project.objects.create(
                organization=org,
                name='Production Cluster (AWS)',
                opencost_url='http://opencost:9003'
            )

        # 2. DSN Authentication Check (optional bearer key matching)
        api_key = request.headers.get('X-Project-Key') or request.query_params.get('sentry_key')
        if api_key and project.api_key != api_key:
            return Response({"error": "Invalid DSN authentication key"}, status=status.HTTP_401_UNAUTHORIZED)

        # 3. Ingest Payload (batch of workload egress metrics)
        data = request.data
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
            inc_id = create_incident(anomaly.id)
            if inc_id:
                incidents_created.append(inc_id)

        return Response({
            "status": "success",
            "project": project.name,
            "snapshot_id": snapshot.id,
            "workloads_ingested": len(workload_instances),
            "anomalies_detected": len(anomalies),
            "incidents_created": incidents_created
        }, status=status.HTTP_201_CREATED)


class TrafficFlowsView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        total_egress_bytes = WorkloadCost.objects.aggregate(total=Sum('network_egress_bytes'))['total'] or 0
        total_cross_zone = WorkloadCost.objects.aggregate(total=Sum('network_cross_zone_cost'))['total'] or 0
        total_internet = WorkloadCost.objects.aggregate(total=Sum('network_internet_cost'))['total'] or 0
        
        top_workloads = WorkloadCost.objects.values('namespace', 'controller_name').annotate(
            total_bytes=Sum('network_egress_bytes'),
            total_cost=Sum('network_cost_total'),
            internet_cost=Sum('network_internet_cost'),
            cross_zone_cost=Sum('network_cross_zone_cost')
        ).order_by('-total_bytes')[:10]

        top_destinations = []
        for item in top_workloads:
            gb = round((item['total_bytes'] or 0) / (1024 ** 3), 2)
            cost = float(item['total_cost'] or 0)
            internet = float(item['internet_cost'] or 0)
            czone = float(item['cross_zone_cost'] or 0)
            cardinality = "High (NAT)" if internet >= czone else "Cross-AZ"
            
            top_destinations.append({
                "destination_ip": f"10.244.{(abs(hash(item['controller_name'])) % 200) + 10}.{(abs(hash(item['namespace'])) % 200) + 1} ({item['namespace']})",
                "namespace": item['namespace'],
                "controller": item['controller_name'],
                "bytes_transferred": f"{gb} GB",
                "cost": round(cost, 2),
                "cardinality": cardinality
            })

        internet_val = float(total_internet or 0)

        return Response({
            "total_egress_gb": round((total_egress_bytes or 0) / (1024 ** 3), 1),
            "cross_zone_cost": round(float(total_cross_zone or 0), 2),
            "internet_cost": round(internet_val, 2),
            "nat_gateway_charges": round(internet_val * 0.45, 2),
            "top_destinations": top_destinations
        })
