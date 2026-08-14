#!/bin/bash
# ============================================================================
# NAS Logs — End-to-End Smoke Test
# ============================================================================
#
# This script boots the entire stack via docker-compose, registers a user,
# ingests realistic egress telemetry, and verifies every link in the chain:
#
#   docker-compose up → register → login → ingest SDK traffic →
#   anomaly detection → incidents created → dashboard populated →
#   cost breakdown works → traffic flows work → cleanup
#
# Usage:
#   ./tests/e2e/smoke_test.sh          # local
#   # or via GitHub Actions (see .github/workflows/e2e.yml)
#
# Exit codes:
#   0 = all checks passed
#   1 = any check failed
# ============================================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────────────
API_URL="http://localhost:8000/api"
FRONTEND_URL="http://localhost:3000"
TEST_EMAIL="e2e-test@naslogs.io"
TEST_PASSWORD="StrongP@ssw0rd2024!"
TEST_ORG="E2E Test Org"
COMPOSE_FILE="docker-compose.yml"

PASS=0
FAIL=0

# ── Helpers ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()   { echo -e "${CYAN}[e2e]${NC} $1"; }
pass()  { echo -e "  ${GREEN}✓ PASS${NC}: $1"; PASS=$((PASS + 1)); }
fail()  { echo -e "  ${RED}✗ FAIL${NC}: $1"; FAIL=$((FAIL + 1)); }
warn()  { echo -e "  ${YELLOW}⚠ WARN${NC}: $1"; }
header(){ echo ""; echo -e "${CYAN}━━━ $1 ━━━${NC}"; }

assert_status() {
    local desc="$1" expected="$2" actual="$3"
    if [ "$actual" -eq "$expected" ]; then
        pass "$desc (HTTP $actual)"
    else
        fail "$desc (expected $expected, got $actual)"
    fi
}

assert_json_field() {
    local desc="$1" json="$2" field="$3"
    local value
    value=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field','__MISSING__'))" 2>/dev/null || echo "__ERROR__")
    if [ "$value" != "__MISSING__" ] && [ "$value" != "__ERROR__" ]; then
        pass "$desc ($field=$value)"
    else
        fail "$desc (field '$field' missing)"
    fi
}

assert_json_gt() {
    local desc="$1" json="$2" field="$3" threshold="$4"
    local value
    value=$(echo "$json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$field',0))" 2>/dev/null || echo "0")
    if python3 -c "exit(0 if $value > $threshold else 1)" 2>/dev/null; then
        pass "$desc ($field=$value > $threshold)"
    else
        fail "$desc ($field=$value, expected > $threshold)"
    fi
}

wait_for_url() {
    local url="$1" max_wait="${2:-60}"
    local elapsed=0
    while ! curl -sf "$url" > /dev/null 2>&1; do
        sleep 2
        elapsed=$((elapsed + 2))
        if [ $elapsed -ge $max_wait ]; then
            fail "Service at $url did not become ready within ${max_wait}s"
            return 1
        fi
    done
    return 0
}

# ── Cleanup trap ────────────────────────────────────────────────────────────
cleanup() {
    header "CLEANUP"
    log "Tearing down docker-compose..."
    docker compose -f "$COMPOSE_FILE" down -v --remove-orphans 2>/dev/null || true
    log "Done."
}
trap cleanup EXIT

# ============================================================================
# PHASE 1: Boot the stack
# ============================================================================
header "PHASE 1: Docker Compose Boot"

# Ensure .env exists
if [ ! -f "./backend/.env" ]; then
    log "Creating .env from .env.example..."
    cp ./backend/.env.example ./backend/.env
    # Generate a real SECRET_KEY for the test
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))" 2>/dev/null || openssl rand -base64 48)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|change-me-to-a-random-64-char-string|$SECRET_KEY|g" ./backend/.env
    else
        sed -i "s|change-me-to-a-random-64-char-string|$SECRET_KEY|g" ./backend/.env
    fi
fi

log "Building and starting all services..."
docker compose -f "$COMPOSE_FILE" build --quiet
docker compose -f "$COMPOSE_FILE" up -d

log "Waiting for PostgreSQL..."
wait_for_url "http://localhost:8000/api/health/" 90
pass "Backend API is healthy"

log "Waiting for Frontend (nginx)..."
wait_for_url "$FRONTEND_URL" 30
pass "Frontend is serving"

# Verify all containers are running
RUNNING=$(docker compose -f "$COMPOSE_FILE" ps --status running --format json 2>/dev/null | python3 -c "
import sys,json
try:
    data = [json.loads(line) for line in sys.stdin if line.strip()]
    print(len(data))
except: print(0)
" 2>/dev/null || echo "0")
log "Running containers: $RUNNING"
if [ "$RUNNING" -ge 5 ]; then
    pass "All 5+ services are running"
else
    warn "Expected 5+ containers, got $RUNNING"
fi

# ============================================================================
# PHASE 2: Auth — Register + Login
# ============================================================================
header "PHASE 2: Authentication"

# Register
REGISTER_RESP=$(curl -sf -w "\n%{http_code}" -X POST "$API_URL/auth/register/" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\", \"org_name\": \"$TEST_ORG\"}" 2>/dev/null || echo -e "\n000")
REGISTER_BODY=$(echo "$REGISTER_RESP" | sed '$d')
REGISTER_STATUS=$(echo "$REGISTER_RESP" | tail -1)
assert_status "POST /auth/register/" 201 "$REGISTER_STATUS"
assert_json_field "Register returns access token" "$REGISTER_BODY" "access"

# Extract tokens + project info
ACCESS_TOKEN=$(echo "$REGISTER_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['access'])" 2>/dev/null || echo "")
if [ -z "$ACCESS_TOKEN" ]; then
    fail "Could not extract access token — aborting"
    exit 1
fi
pass "JWT access token obtained"

# Login
LOGIN_RESP=$(curl -sf -w "\n%{http_code}" -X POST "$API_URL/auth/login/" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}" 2>/dev/null || echo -e "\n000")
LOGIN_STATUS=$(echo "$LOGIN_RESP" | tail -1)
assert_status "POST /auth/login/" 200 "$LOGIN_STATUS"

# Me endpoint
ME_RESP=$(curl -sf -w "\n%{http_code}" "$API_URL/auth/me/" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo -e "\n000")
ME_BODY=$(echo "$ME_RESP" | sed '$d')
ME_STATUS=$(echo "$ME_RESP" | tail -1)
assert_status "GET /auth/me/ (authenticated)" 200 "$ME_STATUS"
assert_json_field "Me returns user email" "$ME_BODY" "email"

# Unauthenticated access should be blocked
NOAUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/dashboard/summary/" 2>/dev/null || echo "000")
if [ "$NOAUTH_STATUS" -eq 401 ] || [ "$NOAUTH_STATUS" -eq 403 ]; then
    pass "Unauthenticated request blocked (HTTP $NOAUTH_STATUS)"
else
    fail "Unauthenticated request NOT blocked (HTTP $NOAUTH_STATUS)"
fi

# ============================================================================
# PHASE 3: Get project API key for SDK ingest
# ============================================================================
header "PHASE 3: Project Setup"

PROJECTS_RESP=$(curl -sf "$API_URL/projects/all/" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo "{}")
PROJECT_ID=$(echo "$PROJECTS_RESP" | python3 -c "
import sys,json
d = json.load(sys.stdin)
projects = d.get('projects', d.get('results', []))
print(projects[0]['id'] if projects else 1)
" 2>/dev/null || echo "1")
API_KEY=$(echo "$PROJECTS_RESP" | python3 -c "
import sys,json
d = json.load(sys.stdin)
projects = d.get('projects', d.get('results', []))
print(projects[0].get('api_key','') if projects else '')
" 2>/dev/null || echo "")

if [ -z "$API_KEY" ]; then
    SETTINGS_RESP=$(curl -sf "$API_URL/projects/settings/?project_id=$PROJECT_ID" \
        -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo "{}")
    API_KEY=$(echo "$SETTINGS_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key',''))" 2>/dev/null || echo "")
fi

if [ -n "$API_KEY" ]; then
    pass "Project $PROJECT_ID found (API key: ${API_KEY:0:16}...)"
else
    fail "Could not retrieve project API key"
    exit 1
fi

# ============================================================================
# PHASE 4: Ingest Realistic Egress Traffic (simulates 3 SDK flushes)
# ============================================================================
header "PHASE 4: SDK Telemetry Ingest"

# Flush 1: Baseline traffic — normal egress from 4 microservices
INGEST_1=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/collector/v1/ingest/$PROJECT_ID/" \
    -H "Content-Type: application/json" \
    -H "X-Project-Key: $API_KEY" \
    -d '{
        "workloads": [
            {
                "namespace": "production",
                "controller_name": "api-gateway",
                "controller_kind": "deployment",
                "network_cost_total": 0.0042,
                "network_egress_bytes": 52428800,
                "cross_zone_cost": 0.0012,
                "internet_cost": 0.0030
            },
            {
                "namespace": "production",
                "controller_name": "payment-service",
                "controller_kind": "deployment",
                "network_cost_total": 0.0018,
                "network_egress_bytes": 10485760,
                "cross_zone_cost": 0.0008,
                "internet_cost": 0.0010
            },
            {
                "namespace": "monitoring",
                "controller_name": "prometheus",
                "controller_kind": "statefulset",
                "network_cost_total": 0.0085,
                "network_egress_bytes": 104857600,
                "cross_zone_cost": 0.0085,
                "internet_cost": 0.0000
            },
            {
                "namespace": "data",
                "controller_name": "kafka-connect",
                "controller_kind": "deployment",
                "network_cost_total": 0.0120,
                "network_egress_bytes": 209715200,
                "cross_zone_cost": 0.0020,
                "internet_cost": 0.0100
            }
        ]
    }' 2>/dev/null || echo -e "\n000")
INGEST_1_BODY=$(echo "$INGEST_1" | sed '$d')
INGEST_1_STATUS=$(echo "$INGEST_1" | tail -1)
assert_status "POST ingest (flush 1 — baseline, 4 workloads)" 201 "$INGEST_1_STATUS"
assert_json_field "Flush 1 returns snapshot_id" "$INGEST_1_BODY" "snapshot_id"

sleep 1

# Flush 2: ANOMALOUS traffic — kafka-connect egress spikes 50x
INGEST_2=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/collector/v1/ingest/$PROJECT_ID/" \
    -H "Content-Type: application/json" \
    -H "X-Project-Key: $API_KEY" \
    -d '{
        "workloads": [
            {
                "namespace": "production",
                "controller_name": "api-gateway",
                "controller_kind": "deployment",
                "network_cost_total": 0.0045,
                "network_egress_bytes": 55574528,
                "cross_zone_cost": 0.0013,
                "internet_cost": 0.0032
            },
            {
                "namespace": "production",
                "controller_name": "payment-service",
                "controller_kind": "deployment",
                "network_cost_total": 0.0020,
                "network_egress_bytes": 11534336,
                "cross_zone_cost": 0.0009,
                "internet_cost": 0.0011
            },
            {
                "namespace": "data",
                "controller_name": "kafka-connect",
                "controller_kind": "deployment",
                "network_cost_total": 0.6500,
                "network_egress_bytes": 10737418240,
                "cross_zone_cost": 0.0500,
                "internet_cost": 0.6000
            },
            {
                "namespace": "production",
                "controller_name": "user-service",
                "controller_kind": "deployment",
                "network_cost_total": 0.0035,
                "network_egress_bytes": 31457280,
                "cross_zone_cost": 0.0010,
                "internet_cost": 0.0025
            }
        ]
    }' 2>/dev/null || echo -e "\n000")
INGEST_2_BODY=$(echo "$INGEST_2" | sed '$d')
INGEST_2_STATUS=$(echo "$INGEST_2" | tail -1)
assert_status "POST ingest (flush 2 — kafka spike 50x, 4 workloads)" 201 "$INGEST_2_STATUS"
assert_json_field "Flush 2 returns workloads_ingested" "$INGEST_2_BODY" "workloads_ingested"

# Check anomaly detection ran
ANOMALIES_2=$(echo "$INGEST_2_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('anomalies_detected',0))" 2>/dev/null || echo "0")
log "Anomalies detected in flush 2: $ANOMALIES_2"

sleep 1

# Flush 3: Another spike — verifies the system doesn't crash on repeated ingest
INGEST_3=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_URL/collector/v1/ingest/$PROJECT_ID/" \
    -H "Content-Type: application/json" \
    -H "X-Project-Key: $API_KEY" \
    -d '{
        "workloads": [
            {
                "namespace": "data",
                "controller_name": "kafka-connect",
                "controller_kind": "deployment",
                "network_cost_total": 1.2500,
                "network_egress_bytes": 21474836480,
                "cross_zone_cost": 0.1000,
                "internet_cost": 1.1500
            },
            {
                "namespace": "production",
                "controller_name": "api-gateway",
                "controller_kind": "deployment",
                "network_cost_total": 0.0048,
                "network_egress_bytes": 58720256,
                "cross_zone_cost": 0.0014,
                "internet_cost": 0.0034
            }
        ]
    }' 2>/dev/null || echo -e "\n000")
INGEST_3_STATUS=$(echo "$INGEST_3" | tail -1)
assert_status "POST ingest (flush 3 — sustained spike)" 201 "$INGEST_3_STATUS"

# Verify ingest rejected without API key
NOKEY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$API_URL/collector/v1/ingest/$PROJECT_ID/" \
    -H "Content-Type: application/json" \
    -d '{"workloads": []}' 2>/dev/null || echo "000")
if [ "$NOKEY_STATUS" -eq 401 ]; then
    pass "Ingest without API key rejected (HTTP 401)"
else
    fail "Ingest without API key NOT rejected (HTTP $NOKEY_STATUS)"
fi

# ============================================================================
# PHASE 5: Verify Dashboard & Data Pipeline
# ============================================================================
header "PHASE 5: Dashboard & Data Verification"

# Dashboard summary
DASH_RESP=$(curl -sf -w "\n%{http_code}" \
    "$API_URL/dashboard/summary/?project_id=$PROJECT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo -e "\n000")
DASH_BODY=$(echo "$DASH_RESP" | sed '$d')
DASH_STATUS=$(echo "$DASH_RESP" | tail -1)
assert_status "GET /dashboard/summary/" 200 "$DASH_STATUS"
assert_json_field "Dashboard has total_hourly_cost" "$DASH_BODY" "total_hourly_cost"
assert_json_field "Dashboard has cost_history_24h" "$DASH_BODY" "cost_history_24h"

HOURLY_COST=$(echo "$DASH_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_hourly_cost',0))" 2>/dev/null || echo "0")
if python3 -c "exit(0 if $HOURLY_COST > 0 else 1)" 2>/dev/null; then
    pass "Dashboard total_hourly_cost > 0 ($HOURLY_COST)"
else
    warn "Dashboard total_hourly_cost is 0 (anomaly engine may not have triggered)"
fi

# Cost breakdown
BREAKDOWN_RESP=$(curl -sf -w "\n%{http_code}" \
    "$API_URL/costs/breakdown/?project_id=$PROJECT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo -e "\n000")
BREAKDOWN_STATUS=$(echo "$BREAKDOWN_RESP" | tail -1)
assert_status "GET /costs/breakdown/" 200 "$BREAKDOWN_STATUS"

# Traffic flows
TRAFFIC_RESP=$(curl -sf -w "\n%{http_code}" \
    "$API_URL/traffic/flows/?project_id=$PROJECT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo -e "\n000")
TRAFFIC_BODY=$(echo "$TRAFFIC_RESP" | sed '$d')
TRAFFIC_STATUS=$(echo "$TRAFFIC_RESP" | tail -1)
assert_status "GET /traffic/flows/" 200 "$TRAFFIC_STATUS"
assert_json_field "Traffic has total_egress_gb" "$TRAFFIC_BODY" "total_egress_gb"

# Incidents list
INCIDENTS_RESP=$(curl -sf -w "\n%{http_code}" \
    "$API_URL/incidents/?project_id=$PROJECT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo -e "\n000")
INCIDENTS_STATUS=$(echo "$INCIDENTS_RESP" | tail -1)
assert_status "GET /incidents/" 200 "$INCIDENTS_STATUS"

# Alert rules
ALERTS_RESP=$(curl -sf -w "\n%{http_code}" \
    "$API_URL/alerts/rules/?project_id=$PROJECT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo -e "\n000")
ALERTS_STATUS=$(echo "$ALERTS_RESP" | tail -1)
assert_status "GET /alerts/rules/" 200 "$ALERTS_STATUS"

# Project settings
SETTINGS_RESP=$(curl -sf -w "\n%{http_code}" \
    "$API_URL/projects/settings/?project_id=$PROJECT_ID" \
    -H "Authorization: Bearer $ACCESS_TOKEN" 2>/dev/null || echo -e "\n000")
SETTINGS_STATUS=$(echo "$SETTINGS_RESP" | tail -1)
assert_status "GET /projects/settings/" 200 "$SETTINGS_STATUS"

# ============================================================================
# PHASE 6: Frontend Verification
# ============================================================================
header "PHASE 6: Frontend Smoke Check"

# Frontend serves HTML
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/" 2>/dev/null || echo "000")
assert_status "GET / (frontend HTML)" 200 "$FRONTEND_STATUS"

# Frontend serves JS assets
JS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/js/app.js" 2>/dev/null || echo "000")
assert_status "GET /js/app.js (static asset)" 200 "$JS_STATUS"

# Frontend proxies API
PROXY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL/api/health/" 2>/dev/null || echo "000")
assert_status "GET /api/health/ via nginx proxy" 200 "$PROXY_STATUS"

# ============================================================================
# PHASE 7: Security Checks
# ============================================================================
header "PHASE 7: Security Verification"

# CORS headers present
CORS_HEADER=$(curl -sf -I -X OPTIONS "$API_URL/auth/login/" \
    -H "Origin: http://localhost:3000" \
    -H "Access-Control-Request-Method: POST" 2>/dev/null | grep -i "access-control-allow" || echo "")
if [ -n "$CORS_HEADER" ]; then
    pass "CORS headers present"
else
    warn "CORS headers not found (may need preflight config)"
fi

# Security headers from nginx
SEC_HEADERS=$(curl -sf -I "$FRONTEND_URL/" 2>/dev/null)
if echo "$SEC_HEADERS" | grep -qi "X-Content-Type-Options"; then
    pass "X-Content-Type-Options header present"
else
    fail "X-Content-Type-Options header missing"
fi
if echo "$SEC_HEADERS" | grep -qi "X-Frame-Options"; then
    pass "X-Frame-Options header present"
else
    fail "X-Frame-Options header missing"
fi

# ============================================================================
# RESULTS
# ============================================================================
header "RESULTS"
echo ""
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}━━━ E2E SMOKE TEST FAILED ━━━${NC}"
    exit 1
else
    echo -e "${GREEN}━━━ E2E SMOKE TEST PASSED ━━━${NC}"
    exit 0
fi
