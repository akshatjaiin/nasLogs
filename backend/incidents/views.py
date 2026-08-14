from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count, Sum, Max, F, DecimalField
from django.db.models.functions import Coalesce
from django.utils import timezone
from datetime import timedelta
from .models import Incident
from .serializers import IncidentSerializer
from collector.models import CostSnapshot, WorkloadCost


class IncidentViewSet(viewsets.ModelViewSet):
    serializer_class = IncidentSerializer

    def get_queryset(self):
        qs = Incident.objects.all()
        project_id = self.request.query_params.get('project_id')
        status = self.request.query_params.get('status')
        severity = self.request.query_params.get('severity')
        search = self.request.query_params.get('search')
        start_time = self.request.query_params.get('start_time')
        end_time = self.request.query_params.get('end_time')

        if project_id and project_id != 'all':
            qs = qs.filter(project_id=project_id)
        if status:
            qs = qs.filter(status=status)
        if severity:
            qs = qs.filter(severity=severity)
        if search:
            qs = qs.filter(title__icontains=search)
        if start_time:
            qs = qs.filter(created_at__gte=start_time)
        if end_time:
            qs = qs.filter(created_at__lte=end_time)

        return qs


class DashboardSummaryView(APIView):

    def get(self, request):
        project_id = request.query_params.get('project_id')
        inc_qs = Incident.objects.all()
        snap_qs = CostSnapshot.objects.all()

        if project_id and project_id != 'all':
            inc_qs = inc_qs.filter(project_id=project_id)
            snap_qs = snap_qs.filter(project_id=project_id)

        open_count = inc_qs.filter(status=Incident.Status.OPEN).count()
        critical_count = inc_qs.filter(
            status=Incident.Status.OPEN, severity='critical'
        ).count()
        
        recent = inc_qs.filter(
            status=Incident.Status.OPEN
        ).order_by('-created_at')[:5]
        recent_data = IncidentSerializer(recent, many=True).data
        
        # Calculate total hourly cost from the latest snapshot
        latest_snapshot = snap_qs.order_by('-timestamp').first()
        total_hourly_cost = 0
        if latest_snapshot:
            total_hourly_cost = float(
                latest_snapshot.workload_costs.aggregate(
                    total=Coalesce(Sum('network_cost_total'), 0, output_field=DecimalField())
                )['total']
            )
        
        # 24h cost history — single query instead of 24 loop queries
        now = timezone.now()
        since_24h = now - timedelta(hours=24)
        snapshots_24h = snap_qs.filter(
            timestamp__gte=since_24h
        ).prefetch_related('workload_costs').order_by('timestamp')
        
        # Bucket snapshots into hourly slots
        cost_history = [0] * 24
        for snap in snapshots_24h:
            hours_ago = (now - snap.timestamp).total_seconds() / 3600
            bucket = int(24 - hours_ago)
            if 0 <= bucket < 24:
                total = sum(float(wc.network_cost_total) for wc in snap.workload_costs.all())
                cost_history[bucket] = max(cost_history[bucket], round(total, 2))
        
        return Response({
            "open_incidents_count": open_count,
            "critical_count": critical_count,
            "total_hourly_cost": round(total_hourly_cost, 2),
            "cost_history_24h": cost_history,
            "recent_incidents": recent_data,
        })


class CostBreakdownView(APIView):
    """Namespace-level cost breakdown with drill-down to controllers."""

    def get(self, request):
        project_id = request.query_params.get('project_id')
        now = timezone.now()

        snap_qs = CostSnapshot.objects.all()
        if project_id and project_id != 'all':
            snap_qs = snap_qs.filter(project_id=project_id)

        latest_snapshot = snap_qs.order_by('-timestamp').first()
        
        if not latest_snapshot:
            return Response({"namespaces": []})
        
        # Current costs by namespace+controller
        current_costs = WorkloadCost.objects.filter(
            snapshot=latest_snapshot
        ).values(
            'namespace', 'controller_name', 'controller_kind'
        ).annotate(
            cost=Sum('network_cost_total')
        )
        
        # Baseline costs (7 days ago)
        baseline_time = now - timedelta(days=7)
        baseline_snapshot = snap_qs.filter(
            timestamp__lte=baseline_time
        ).order_by('-timestamp').first()
        
        baseline_map = {}
        if baseline_snapshot:
            for wc in baseline_snapshot.workload_costs.all():
                key = f"{wc.namespace}/{wc.controller_name}"
                baseline_map[key] = float(wc.network_cost_total)
        
        # Build namespace tree
        ns_map = {}
        for item in current_costs:
            ns = item['namespace']
            if ns not in ns_map:
                ns_map[ns] = {'namespace': ns, 'total_cost': 0, 'controllers': []}
            
            cost = float(item['cost'])
            key = f"{ns}/{item['controller_name']}"
            baseline = baseline_map.get(key, 0)
            delta_pct = 0
            if baseline > 0:
                delta_pct = round(((cost - baseline) / baseline) * 100)
            elif cost > 0:
                delta_pct = 999
            
            ns_map[ns]['total_cost'] += cost
            ns_map[ns]['controllers'].append({
                'name': item['controller_name'],
                'kind': item['controller_kind'],
                'cost': round(cost, 2),
                'delta_pct': delta_pct,
            })
        
        # Calculate namespace-level deltas
        namespaces = []
        for ns_data in ns_map.values():
            ns_baseline = sum(
                baseline_map.get(f"{ns_data['namespace']}/{c['name']}", 0)
                for c in ns_data['controllers']
            )
            if ns_baseline > 0:
                ns_data['delta_pct'] = round(
                    ((ns_data['total_cost'] - ns_baseline) / ns_baseline) * 100
                )
            elif ns_data['total_cost'] > 0:
                ns_data['delta_pct'] = 999
            else:
                ns_data['delta_pct'] = 0
            
            ns_data['total_cost'] = round(ns_data['total_cost'], 2)
            namespaces.append(ns_data)
        
        namespaces.sort(key=lambda x: x['total_cost'], reverse=True)
        
        return Response({"namespaces": namespaces})


class CostHistoryView(APIView):
    """Return detailed cost history & egress telemetry for a specific workload."""

    def get(self, request):
        namespace = request.query_params.get('namespace')
        controller = request.query_params.get('controller')
        hours = int(request.query_params.get('hours', 24))
        project_id = request.query_params.get('project_id')
        
        if not namespace or not controller:
            return Response({"error": "namespace and controller params required"}, status=400)
        
        now = timezone.now()
        data_points = []
        total_cost_sum = 0
        total_bytes_sum = 0

        # Step size adjustment for long ranges (7d / 30d)
        step = 1 if hours <= 24 else (7 if hours <= 168 else 30)

        since = now - timedelta(hours=hours)
        wc_qs = WorkloadCost.objects.filter(
            snapshot__timestamp__gte=since,
            namespace=namespace,
            controller_name=controller
        )

        if project_id and project_id != 'all':
            wc_qs = wc_qs.filter(snapshot__project_id=project_id)

        workloads = wc_qs.select_related('snapshot').order_by('snapshot__timestamp')
        
        # Bucket into time slots
        num_buckets = hours // step
        data_points = []
        buckets = {}
        
        for wc in workloads:
            hours_ago = (now - wc.snapshot.timestamp).total_seconds() / 3600
            bucket_idx = int((hours - hours_ago) / step)
            if 0 <= bucket_idx < num_buckets:
                buckets[bucket_idx] = wc
        
        for i in range(num_buckets):
            slot_time = now - timedelta(hours=hours - (i * step))
            wc = buckets.get(i)
            cost_val = float(wc.network_cost_total) if wc else 0.0
            bytes_val = int(wc.network_egress_bytes) if wc else 0
            czone_val = float(wc.network_cross_zone_cost) if wc else 0.0
            internet_val = float(wc.network_internet_cost) if wc else 0.0
            
            total_cost_sum += cost_val
            total_bytes_sum += bytes_val
            
            data_points.append({
                'timestamp': slot_time.strftime('%Y-%m-%d %H:%M'),
                'value': round(cost_val, 2),
                'egress_bytes': bytes_val,
                'cross_zone_cost': round(czone_val, 2),
                'internet_cost': round(internet_val, 2)
            })

        return Response({
            "namespace": namespace,
            "controller": controller,
            "hours": hours,
            "total_cost": round(total_cost_sum, 2),
            "total_egress_gb": round(total_bytes_sum / (1024 ** 3), 2),
            "data": data_points
        })
