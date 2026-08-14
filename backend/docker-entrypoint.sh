#!/bin/bash
# NAS Logs Docker Entrypoint (Sentry-inspired)
# Handles: .env setup, migrations, static files, signal forwarding

set -e

echo "=========================================="
echo " NAS Logs — Starting up..."
echo "=========================================="

# Auto-copy .env.example if .env doesn't exist (prevents first-run crash)
if [ ! -f /app/.env ] && [ -f /app/.env.example ]; then
    echo "[entrypoint] No .env found — copying from .env.example..."
    cp /app/.env.example /app/.env 2>/dev/null || true
    echo "[entrypoint] WARNING: Using default .env — update SECRET_KEY for production!"
fi

# Ensure filestore storage directory exists
mkdir -p /data/files 2>/dev/null || true
mkdir -p /app/staticfiles 2>/dev/null || true

# Run database migrations
echo "[entrypoint] Running database migrations..."
python manage.py migrate --noinput 2>&1

# Collect static files (for Django admin)
echo "[entrypoint] Collecting static files..."
python manage.py collectstatic --noinput 2>&1 || true

# If first arg starts with a flag, prepend gunicorn
if [ "${1:0:1}" = '-' ]; then
    set -- gunicorn config.wsgi:application "$@"
fi

# Execute the main command
echo "[entrypoint] Executing: $@"
exec "$@"
