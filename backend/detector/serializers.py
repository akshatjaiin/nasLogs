from rest_framework import serializers
from .models import AnomalyThreshold, Anomaly

class AnomalyThresholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnomalyThreshold
        fields = '__all__'

class AnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model = Anomaly
        fields = '__all__'
