FROM python:3.12-slim

LABEL maintainer="naslogs@example.com"
LABEL org.opencontainers.image.title="NAS Logs"
LABEL org.opencontainers.image.description="Sentry-like network cost observability for Kubernetes"
LABEL org.opencontainers.image.url="https://github.com/akshatjaiin/nasLogs"

# Install tini for proper PID 1 signal handling (Sentry pattern)
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create non-root user (Sentry: useradd -r -m -g sentry --uid 999 sentry)
RUN groupadd -r nasuser --gid 999 && useradd -r -m -g nasuser --uid 999 nasuser

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh

# Collect static files at build time (for Django admin)
RUN SECRET_KEY=build-placeholder python manage.py collectstatic --noinput 2>/dev/null || true

# Create data directory for future file storage
RUN mkdir -p /data && chown nasuser:nasuser /data
VOLUME /data

# Switch to non-root user
USER nasuser

EXPOSE 8000

# Use tini as PID 1 for zombie process reaping
ENTRYPOINT ["tini", "--", "/app/docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "-c", "/app/gunicorn.conf.py"]
