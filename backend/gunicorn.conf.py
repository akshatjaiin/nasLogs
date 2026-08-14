# Gunicorn production configuration for NAS Logs
# Inspired by Sentry's SENTRY_WEB_OPTIONS pattern

import os
import multiprocessing

# Workers: Sentry recommends (2 * CPU cores) + 1
workers = int(os.environ.get('GUNICORN_WORKERS', min(multiprocessing.cpu_count() * 2 + 1, 8)))
worker_class = 'gthread'
threads = int(os.environ.get('GUNICORN_THREADS', 4))

# Binding
bind = '0.0.0.0:8000'

# Timeouts
timeout = int(os.environ.get('GUNICORN_TIMEOUT', 30))
graceful_timeout = 10
keepalive = 5

# Memory leak protection: restart workers after N requests
max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', 10000))
max_requests_jitter = 1000

# Logging
accesslog = '-'  # stdout
errorlog = '-'   # stderr
loglevel = os.environ.get('GUNICORN_LOG_LEVEL', 'info')
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)sus'

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Preload app for faster worker fork
preload_app = True
