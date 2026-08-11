from rest_framework import serializers
from .models import K8sEvent, Correlation

class K8sEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = K8sEvent
        fields = '__all__'

class CorrelationSerializer(serializers.ModelSerializer):
    k8s_event = K8sEventSerializer(read_only=True)
    
    class Meta:
        model = Correlation
        fields = '__all__'
