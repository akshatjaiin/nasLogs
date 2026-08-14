from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from core.models import Organization, Project, UserProfile
from detector.models import AnomalyThreshold
import secrets

class RegisterView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        org_name = request.data.get('org_name')

        if not email or not password:
            return Response({'error': 'Email and password required'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=email).exists():
            return Response({'error': 'User already exists'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(username=email, email=email, password=password)

        if not org_name:
            org_name = email.split('@')[0] + " Org"

        org = Organization.objects.create(name=org_name, slug=org_name.lower().replace(' ', '-') + '-' + secrets.token_hex(4))
        
        project = Project.objects.create(
            organization=org,
            name="Default Project",
            opencost_url="http://opencost:9003"
        )
        
        AnomalyThreshold.objects.create(
            project=project,
            metric='network_cost_total',
            method=AnomalyThreshold.Method.PCT_CHANGE,
            warning_value=2.0,
            critical_value=5.0,
            baseline_window_hours=168,
            min_cost_threshold=0.0100,
        )

        UserProfile.objects.create(user=user, organization=org)

        refresh = RefreshToken.for_user(user)

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {'id': user.id, 'email': user.email, 'org': org.name}
        }, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        user = authenticate(username=email, password=password)
        if not user:
            return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {'id': user.id, 'email': user.email}
        })

class RefreshView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'Refresh token required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh = RefreshToken(refresh_token)
            return Response({'access': str(refresh.access_token)})
        except Exception:
            return Response({'error': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

class MeView(APIView):
    def get(self, request):
        user = request.user
        profile = getattr(user, 'profile', None)
        org = profile.organization if profile else None
        
        projects_data = []
        if org:
            for p in org.projects.all():
                projects_data.append({
                    'id': p.id,
                    'name': p.name,
                    'api_key': p.api_key
                })

        return Response({
            'id': user.id,
            'email': user.email,
            'organization': {'id': org.id, 'name': org.name} if org else None,
            'projects': projects_data
        })

class LogoutView(APIView):
    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'Refresh token required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'status': 'logged out'})
        except Exception:
            return Response({'error': 'Invalid refresh token'}, status=status.HTTP_400_BAD_REQUEST)
