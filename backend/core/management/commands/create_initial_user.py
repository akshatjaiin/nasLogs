import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import Organization, Project, UserProfile
from detector.models import AnomalyThreshold
import secrets


class Command(BaseCommand):
    help = (
        'Create an initial admin user non-interactively. '
        'Reads from env vars: INITIAL_USER_EMAIL, INITIAL_USER_PASSWORD. '
        'Skips if a user already exists.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, help='Admin email (or set INITIAL_USER_EMAIL env var)')
        parser.add_argument('--password', type=str, help='Admin password (or set INITIAL_USER_PASSWORD env var)')
        parser.add_argument('--org', type=str, default='', help='Organization name (default: derived from email)')

    def handle(self, *args, **options):
        email = options.get('email') or os.environ.get('INITIAL_USER_EMAIL')
        password = options.get('password') or os.environ.get('INITIAL_USER_PASSWORD')

        if not email or not password:
            self.stderr.write(self.style.ERROR(
                'Usage: python manage.py create_initial_user --email admin@example.com --password yourpassword\n'
                'Or set INITIAL_USER_EMAIL and INITIAL_USER_PASSWORD environment variables.'
            ))
            return

        if User.objects.exists():
            self.stdout.write(self.style.WARNING('Users already exist. Skipping initial user creation.'))
            return

        org_name = options.get('org') or email.split('@')[0] + ' Org'
        slug = org_name.lower().replace(' ', '-') + '-' + secrets.token_hex(4)

        org = Organization.objects.create(name=org_name, slug=slug)
        self.stdout.write(f'  Created organization: {org.name}')

        project = Project.objects.create(
            organization=org,
            name='Default Project',
            opencost_url='http://opencost:9003',
        )
        self.stdout.write(f'  Created project: {project.name} (API key: {project.api_key})')

        AnomalyThreshold.objects.create(
            project=project,
            metric='network_cost_total',
            method=AnomalyThreshold.Method.PCT_CHANGE,
            warning_value=2.0,
            critical_value=5.0,
            baseline_window_hours=168,
            min_cost_threshold=0.0100,
        )

        user = User.objects.create_superuser(username=email, email=email, password=password)
        UserProfile.objects.create(user=user, organization=org)

        self.stdout.write(self.style.SUCCESS(f'  Created admin user: {email}'))
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Initial setup complete! You can now log in.'))
