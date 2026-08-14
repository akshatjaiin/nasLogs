from django.db import connection
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class HealthCheckView(APIView):
    """Deep system health check: verifies PostgreSQL DB and Redis cache connectivity."""
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        db_ok = False
        redis_ok = False

        # 1. Test PostgreSQL DB
        try:
            connection.ensure_connection()
            db_ok = True
        except Exception:
            db_ok = False

        # 2. Test Redis / Cache
        try:
            cache.set('health_check', 'ok', 10)
            redis_ok = (cache.get('health_check') == 'ok')
        except Exception:
            redis_ok = False

        overall_status = "ok" if (db_ok and redis_ok) else ("degraded" if db_ok else "failed")
        http_status = status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE

        return Response({
            "status": overall_status,
            "version": "0.1.0",
            "services": {
                "database": "ok" if db_ok else "unreachable",
                "redis": "ok" if redis_ok else "unreachable"
            }
        }, status=http_status)
