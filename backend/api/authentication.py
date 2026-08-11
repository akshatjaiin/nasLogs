from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from core.models import Project

class APIKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        api_key = request.META.get('HTTP_X_API_KEY')
        if not api_key:
            return None
            
        try:
            project = Project.objects.get(api_key=api_key)
        except Project.DoesNotExist:
            raise AuthenticationFailed('Invalid API Key')
            
        return (project, None)
