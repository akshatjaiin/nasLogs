from rest_framework import serializers
from .models import CostSnapshot, WorkloadCost

class WorkloadCostSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkloadCost
        fields = '__all__'

class CostSnapshotSerializer(serializers.ModelSerializer):
    workload_costs = WorkloadCostSerializer(many=True, read_only=True)
    
    class Meta:
        model = CostSnapshot
        fields = '__all__'
