import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

from dotenv import load_dotenv
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-default-key-for-dev')
DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 'yes')
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '*').split(',')

# Sentry pattern: crash loudly if SECRET_KEY is insecure in production
if not DEBUG and SECRET_KEY == 'django-insecure-default-key-for-dev':
    raise Exception(
        'Error: SECRET_KEY is undefined or using the insecure default. '
        'Run: python -c "import secrets; print(secrets.token_urlsafe(64))" '
        'and set SECRET_KEY in your .env file.'
    )
if not DEBUG and len(SECRET_KEY) < 32:
    print('!' * 60)
    print('!!  WARNING: SECRET_KEY is less than 32 characters.       !!')
    print('!!  This is potentially insecure. Please regenerate it.   !!')
    print('!' * 60)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'core',
    'collector',
    'detector',
    'correlator',
    'incidents',
    'alerts',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:8000').split(',')
CORS_ALLOW_CREDENTIALS = True

# Sentry pattern: CSRF trusted origins must include the frontend domain for POSTs through nginx
CSRF_TRUSTED_ORIGINS = os.environ.get('CSRF_TRUSTED_ORIGINS', os.environ.get('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:8000')).split(',')

# Support nginx HTTPS proxy (X-Forwarded-Proto header)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Session and cookie security (enforce in production)
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SECURE = True

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

if os.environ.get('DATABASE_HOST'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DATABASE_NAME', 'smokedetector'),
            'USER': os.environ.get('DATABASE_USER', 'postgres'),
            'PASSWORD': os.environ.get('DATABASE_PASSWORD', 'postgrespassword'),
            'HOST': os.environ.get('DATABASE_HOST', 'db'),
            'PORT': os.environ.get('DATABASE_PORT', '5432'),
            'CONN_MAX_AGE': int(os.environ.get('CONN_MAX_AGE', 600)),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
FILESTORE_DIR = Path(os.environ.get('FILESTORE_DIR', '/data/files'))
MEDIA_URL = 'media/'
MEDIA_ROOT = FILESTORE_DIR
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'alerts@naslogs.io')
SERVER_EMAIL = os.environ.get('SERVER_EMAIL', DEFAULT_FROM_EMAIL)

CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0'))
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'UTC'

# Redis-backed cache (used by HealthCheckView to verify Redis connectivity)
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/1')),
    }
}
CELERY_BEAT_SCHEDULE = {
    'collect-cost-snapshots-every-5m': {
        'task': 'collector.tasks.collect_all_active_projects',
        'schedule': 300.0,  # Run every 5 minutes
    },
    'run-anomaly-detection-every-5m': {
        'task': 'detector.tasks.detect_all_active_anomalies',
        'schedule': 300.0,  # Run every 5 minutes
    },
    'cleanup-old-snapshots-daily': {
        'task': 'collector.tasks.cleanup_old_snapshots',
        'schedule': 86400.0,  # Run daily at midnight
    },
    'send-alert-digest-every-5m': {
        'task': 'alerts.tasks.send_alert_digest',
        'schedule': 300.0,  # Run every 5 minutes
    },
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} [{module}] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'nas_logs': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'collector': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'ingest': '120/minute',
    }
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# Email Backend
if os.environ.get('EMAIL_HOST'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
    EMAIL_USE_TLS = True
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

SITE_URL = os.environ.get('SITE_URL', 'http://localhost:3000')

# Sentry pattern: validate Redis is reachable in production
if not DEBUG and 'pytest' not in sys.modules and 'test' not in sys.argv:
    import urllib.request
    _redis_url = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    try:
        from urllib.parse import urlparse
        _parsed = urlparse(_redis_url)
        import socket
        _sock = socket.create_connection((_parsed.hostname or 'localhost', _parsed.port or 6379), timeout=3)
        _sock.close()
    except Exception:
        print('!' * 60)
        print(f'!!  WARNING: Cannot connect to Redis at {_redis_url}')
        print('!!  Celery tasks and caching will not work.            !!')
        print('!' * 60)

if 'pytest' in sys.modules or 'test' in sys.argv:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True

# Single organization mode (Sentry pattern: SENTRY_SINGLE_ORGANIZATION)
# When True, simplifies UI for self-hosted single-team deployments
SINGLE_ORGANIZATION = os.environ.get('SINGLE_ORGANIZATION', 'True').lower() in ('true', '1', 'yes')

# Sentry pattern: allow self-hosters to override any setting without editing source
# Create backend/local_settings.py to override anything above
try:
    from local_settings import *  # noqa: F401,F403
except ImportError:
    pass
