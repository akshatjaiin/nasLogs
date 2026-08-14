#!/bin/bash
# ============================================================
# GressTrace — First-Run Installation Script
# Inspired by Sentry's ./install.sh
# ============================================================

set -e

echo ""
echo "=========================================="
echo "   ⚡ GressTrace — Self-Hosted Setup"
echo "=========================================="
echo ""

ENV_FILE="./backend/.env"
ENV_EXAMPLE="./backend/.env.example"

# Step 1: Create .env if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
        echo "[1/5] Creating .env from .env.example..."
        cp "$ENV_EXAMPLE" "$ENV_FILE"
    else
        echo "[1/5] ERROR: $ENV_EXAMPLE not found!"
        exit 1
    fi
else
    echo "[1/5] .env already exists, skipping..."
fi

# Step 2: Generate SECRET_KEY if still using default
if grep -q "change-me-to-a-random-64-char-string" "$ENV_FILE" 2>/dev/null; then
    echo "[2/5] Generating secure SECRET_KEY..."
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))" 2>/dev/null || openssl rand -base64 48)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|change-me-to-a-random-64-char-string|$SECRET_KEY|g" "$ENV_FILE"
    else
        sed -i "s|change-me-to-a-random-64-char-string|$SECRET_KEY|g" "$ENV_FILE"
    fi
    echo "   SECRET_KEY generated and written to .env"
else
    echo "[2/5] SECRET_KEY already configured, skipping..."
fi

# Step 3: Build Docker images
echo "[3/5] Building Docker images..."
docker compose build

# Step 4: Start services and run migrations
echo "[4/5] Starting services..."
docker compose up -d

echo "   Waiting for services to be ready..."
sleep 8

# Step 5: Create initial admin user
echo "[5/5] Creating initial admin user..."
echo ""

if [ -z "$INITIAL_USER_EMAIL" ]; then
    INITIAL_USER_EMAIL="admin@naslogs.io"
fi
if [ -z "$INITIAL_USER_PASSWORD" ]; then
    INITIAL_USER_PASSWORD="adminpassword123"
fi

docker compose exec -T web python manage.py create_initial_user \
    --email "$INITIAL_USER_EMAIL" \
    --password "$INITIAL_USER_PASSWORD" \
    2>&1 || echo "   (User setup completed)"

echo ""
echo "=========================================="
echo "   ⚡ GressTrace is ready!"
echo "=========================================="
echo ""
echo "   Web Dashboard:  http://localhost:3000"
echo "   DSN Setup:      http://localhost:3000/docs"
echo "   Django REST:    http://localhost:8000/api/"
echo "   Login Email:    $INITIAL_USER_EMAIL"
echo "   Login Password: $INITIAL_USER_PASSWORD"
echo ""
echo "   To view logs:   docker compose logs -f"
echo "   To stop:        docker compose down"
echo ""
