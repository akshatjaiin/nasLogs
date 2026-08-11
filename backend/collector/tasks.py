from celery import shared_task
from django.utils import timezone
from core.models import Project
from .models import CostSnapshot, WorkloadCost
from .client import OpenCostClient, OpenCostError
import logging

logger = logging.getLogger(__name__)

@shared_task
def collect_cost_snapshot(project_id):
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        return
        
    client = OpenCostClient(project.opencost_url)
    try:
        raw_data = client.fetch_allocation()
        
        snapshot = CostSnapshot.objects.create(
            project=project,
            timestamp=timezone.now(),
            window_start=timezone.now() - timezone.timedelta(hours=1),
            window_end=timezone.now(),
            raw_response=raw_data
        )
        
        parsed_data = client.parse_allocation_response(raw_data)
        
        workloads = []
        for item in parsed_data:
            workloads.append(WorkloadCost(
                snapshot=snapshot,
                namespace=item['namespace'],
                controller_kind=item['controller_kind'],
                controller_name=item['controller_name'],
                network_cost_total=item['network_cost'],
                network_egress_bytes=item['egress_bytes'],
                network_cross_zone_cost=item['cross_zone_cost'],
                network_cross_region_cost=item['cross_region_cost'],
                network_internet_cost=item['internet_cost']
            ))
            
        WorkloadCost.objects.bulk_create(workloads)
        
    except OpenCostError as e:
        logger.error(f"Failed to collect cost for project {project_id}: {e}")
