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
        status = self.request.query_params.get('status')
        severity = self.request.query_params.get('severity')
        search = self.request.query_params.get('search')
        
        if status:
            qs = qs.filter(status=status)
        if severity:
            qs = qs.filter(severity=severity)
        if search:
            qs = qs.filter(title__icontains=search)
            
        return qs


class DashboardSummaryView(APIView):
    def get(self, request):
        open_count = Incident.objects.filter(status=Incident.Status.OPEN).count()
        critical_count = Incident.objects.filter(
            status=Incident.Status.OPEN, severity='critical'
        ).count()
        
        recent = Incident.objects.filter(
            status=Incident.Status.OPEN
        ).order_by('-created_at')[:5]
        recent_data = IncidentSerializer(recent, many=True).data
        
        # Calculate total hourly cost from the latest snapshot
        latest_snapshot = CostSnapshot.objects.order_by('-timestamp').first()
        total_hourly_cost = 0
        if latest_snapshot:
            total_hourly_cost = float(
                latest_snapshot.workload_costs.aggregate(
                    total=Coalesce(Sum('network_cost_total'), 0, output_field=DecimalField())
                )['total']
            )
        
        # 24h cost history (hourly totals)
        now = timezone.now()
        cost_history = []
        for i in range(24):
            hour_start = now - timedelta(hours=24-i)
            hour_end = hour_start + timedelta(hours=1)
            snapshot = CostSnapshot.objects.filter(
                timestamp__gte=hour_start, timestamp__lt=hour_end
            ).first()
            if snapshot:
                hour_total = float(
                    snapshot.workload_costs.aggregate(
                        total=Coalesce(Sum('network_cost_total'), 0, output_field=DecimalField())
                    )['total']
                )
                cost_history.append(round(hour_total, 2))
            else:
                cost_history.append(0)
        
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
        # Get the latest snapshot per unique timestamp
        now = timezone.now()
        latest_snapshot = CostSnapshot.objects.order_by('-timestamp').first()
        
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
        baseline_snapshot = CostSnapshot.objects.filter(
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
    """Return cost history for a specific workload."""
    
    def get(self, request):
        namespace = request.query_params.get('namespace')
        controller = request.query_params.get('controller')
        hours = int(request.query_params.get('hours', 24))
        
        if not namespace or not controller:
            return Response({"error": "namespace and controller params required"}, status=400)
        
        now = timezone.now()
        data_points = []
        for i in range(hours):
            hour_start = now - timedelta(hours=hours - i)
            hour_end = hour_start + timedelta(hours=1)
            
            wc = WorkloadCost.objects.filter(
                snapshot__timestamp__gte=hour_start,
                snapshot__timestamp__lt=hour_end,
                namespace=namespace,
                controller_name=controller
            ).first()
            
            data_points.append({
                'timestamp': hour_start.isoformat(),
                'value': float(wc.network_cost_total) if wc else 0
            })
        
        return Response({"data": data_points})
