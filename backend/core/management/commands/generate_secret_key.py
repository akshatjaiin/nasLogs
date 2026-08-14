import secrets
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Generate a cryptographically secure SECRET_KEY for production use.'

    def handle(self, *args, **options):
        key = secrets.token_urlsafe(64)
        self.stdout.write('')
        self.stdout.write('Generated SECRET_KEY:')
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(key))
        self.stdout.write('')
        self.stdout.write('Add this to your .env file:')
        self.stdout.write(f'SECRET_KEY={key}')
        self.stdout.write('')
