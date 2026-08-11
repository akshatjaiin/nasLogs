# Test Plan: Network Cost Smoke Detector

> Sentry-inspired: every test defines **exact input** and **exact expected output**.
> No vague assertions. If it's not specified, it's not tested.

---

## Test Fixture: Base Data

All tests share these baseline fixtures:

```python
# Organization
org = Organization(name="Acme Corp", slug="acme-corp")

# Project
project = Project(
    organization=org,
    name="Production Cluster",
    opencost_url="http://opencost:9003",
    api_key="test-api-key-abc123"
)

# Default threshold
threshold = AnomalyThreshold(
    project=project,
    metric="network_cost_total",
    method="pct_change",
    warning_value=2.0,      # 200% increase
    critical_value=5.0,      # 500% increase
    baseline_window_hours=168,  # 7 days
    min_cost_threshold=0.01,
)
```

---

## DOMAIN 1: COLLECTOR (OpenCost Ingestion)

### TEST 1.1 — Valid OpenCost response creates correct records

**Input:**
```python
# Mock OpenCost /allocation/compute response
opencost_response = {
    "code": 200,
    "data": [
        {
            "cart-service": {
                "name": "cart-service",
                "properties": {
                    "namespace": "ecommerce",
                    "controllerKind": "deployment",
                    "controller": "ecommerce/cart-service"
                },
                "networkCost": 1.234567,
                "networkCrossZoneCost": 0.5,
                "networkCrossRegionCost": 0.2,
                "networkInternetCost": 0.534567,
                "networkEgressBytes": 5368709120  # ~5 GiB
            },
            "image-worker": {
                "name": "image-worker",
                "properties": {
                    "namespace": "media",
                    "controllerKind": "deployment",
                    "controller": "media/image-worker"
                },
                "networkCost": 82.41,
                "networkCrossZoneCost": 12.3,
                "networkCrossRegionCost": 0.0,
                "networkInternetCost": 70.11,
                "networkEgressBytes": 107374182400  # ~100 GiB
            }
        }
    ]
}
```

**Expected:**
- 1 `CostSnapshot` created with `window_start`, `window_end`, `raw_response` = the full response
- 2 `WorkloadCost` records created:

| Field | cart-service | image-worker |
|---|---|---|
| namespace | `ecommerce` | `media` |
| controller_kind | `deployment` | `deployment` |
| controller_name | `cart-service` | `image-worker` |
| network_cost_total | `1.234567` | `82.410000` |
| network_egress_bytes | `5368709120` | `107374182400` |
| network_cross_zone_cost | `0.500000` | `12.300000` |
| network_cross_region_cost | `0.200000` | `0.000000` |
| network_internet_cost | `0.534567` | `70.110000` |

---

### TEST 1.2 — Empty OpenCost response

**Input:**
```python
opencost_response = {"code": 200, "data": [{}]}
```

**Expected:**
- 1 `CostSnapshot` created (we still record the poll)
- 0 `WorkloadCost` records
- No exceptions raised

---

### TEST 1.3 — OpenCost unavailable (connection error)

**Input:**
```python
# requests.get raises ConnectionError
```

**Expected:**
- 0 `CostSnapshot` records created
- No crash
- Error logged with message containing "OpenCost" and "connection"
- Celery task returns `None` (not an exception)

---

### TEST 1.4 — Duplicate snapshot window is idempotent

**Input:**
```python
# Two calls with same window_start and window_end
window_start = "2026-08-11T14:00:00Z"
window_end = "2026-08-11T15:00:00Z"
# Call collect_cost_snapshot twice with same data
```

**Expected:**
- Only 1 `CostSnapshot` exists (unique_together constraint)
- Second call does not crash — handled gracefully
- WorkloadCost count matches first ingestion only

---

### TEST 1.5 — Malformed response (missing fields)

**Input:**
```python
opencost_response = {
    "code": 200,
    "data": [
        {
            "broken-service": {
                "name": "broken-service",
                # missing "properties", "networkCost" etc
            }
        }
    ]
}
```

**Expected:**
- 1 `CostSnapshot` created
- 0 `WorkloadCost` records (malformed entry skipped)
- Warning logged with service name "broken-service"
- No crash

---

## DOMAIN 2: DETECTOR (Anomaly Detection)

### TEST 2.1 — Normal cost, no anomaly

**Input:**
```python
# Baseline: 7 days of hourly snapshots, cart-service costs ~$1.20/hour
baseline_values = [1.18, 1.22, 1.19, 1.25, 1.20, 1.21, 1.23, ...]  # 168 values, mean ≈ 1.21

# Current snapshot
current_value = 1.35  # slightly above average, but within normal range

# Threshold: pct_change, warning=2.0 (200%), critical=5.0 (500%)
```

**Expected:**
```python
is_anomaly = False
severity = None
deviation_score = 0.116  # (1.35 - 1.21) / 1.21 ≈ 11.6%, well below 200%
```
- 0 `Anomaly` records created

---

### TEST 2.2 — 300% spike triggers WARNING

**Input:**
```python
baseline_values = [1.20] * 168  # steady $1.20/hour for 7 days
current_value = 4.80  # 4x the baseline = 300% increase

# Threshold: warning=2.0 (200%), critical=5.0 (500%)
```

**Expected:**
```python
is_anomaly = True
severity = "warning"
deviation_score = 3.0  # (4.80 - 1.20) / 1.20 = 3.0 = 300%
```
- 1 `Anomaly` created with:
  - `baseline_value = 1.200000`
  - `spike_value = 4.800000`
  - `severity = "warning"`
  - `namespace = "ecommerce"`
  - `controller_name = "cart-service"`

---

### TEST 2.3 — 600% spike triggers CRITICAL

**Input:**
```python
baseline_values = [1.20] * 168
current_value = 8.40  # 7x the baseline = 600% increase

# Threshold: warning=2.0, critical=5.0
```

**Expected:**
```python
is_anomaly = True
severity = "critical"
deviation_score = 6.0  # (8.40 - 1.20) / 1.20 = 6.0 = 600%
```
- 1 `Anomaly` with `severity = "critical"`

---

### TEST 2.4 — Gradual growth is NOT an anomaly

**Input:**
```python
# Cost has been growing 2% per day for 7 days
# Day 1: $1.00, Day 2: $1.02, Day 3: $1.04, ... Day 7: $1.14
baseline_values = [1.00, 1.00, ..., 1.02, 1.02, ..., 1.04, ...]  # 168 hourly values
# Mean ≈ $1.07, std_dev ≈ 0.04

current_value = 1.16  # continues the trend

# Threshold: pct_change, warning=2.0
```

**Expected:**
```python
is_anomaly = False
# (1.16 - 1.07) / 1.07 ≈ 8.4%, not a spike
```

---

### TEST 2.5 — Zero-cost workload suddenly active

**Input:**
```python
baseline_values = [0.0] * 168  # workload had zero network cost for 7 days
current_value = 5.50  # suddenly $5.50 in network cost

# min_cost_threshold = 0.01
```

**Expected:**
```python
is_anomaly = True
severity = "critical"
# When baseline mean is 0, any value above min_cost_threshold is anomalous
```
- 1 `Anomaly` with `baseline_value = 0.0`, `spike_value = 5.50`

---

### TEST 2.6 — Z-score on variable baseline

**Input:**
```python
# Variable workload: costs fluctuate between $0.50 and $3.00
import random
random.seed(42)
baseline_values = [random.uniform(0.50, 3.00) for _ in range(168)]
# mean ≈ 1.75, std_dev ≈ 0.72

current_value = 5.50  # well above normal variation

# Threshold: zscore, warning=2.0, critical=3.0
```

**Expected:**
```python
z_score = (5.50 - 1.75) / 0.72  # ≈ 5.21
is_anomaly = True
severity = "critical"  # z > 3.0
```

---

### TEST 2.7 — Multiple workloads spike independently

**Input:**
```python
# Snapshot contains 3 workloads
# cart-service: baseline $1.20, current $6.00 (400% spike)
# image-worker: baseline $80.00, current $82.00 (2.5% — normal)
# payment-api: baseline $0.50, current $4.00 (700% spike)
```

**Expected:**
- 2 `Anomaly` records created (cart-service and payment-api)
- 0 anomalies for image-worker
- Each Anomaly has correct namespace and controller_name

---

### TEST 2.8 — Below minimum cost threshold is ignored

**Input:**
```python
baseline_values = [0.001] * 168  # tiny cost
current_value = 0.005  # 400% increase but below $0.01 min threshold

# min_cost_threshold = 0.01
```

**Expected:**
```python
is_anomaly = False
# Cost is too small to care about, even with 400% increase
```

---

## DOMAIN 3: CORRELATOR (Deployment Blame)

### TEST 3.1 — Deployment 5 minutes before spike → high confidence

**Input:**
```python
# Anomaly detected at 2026-08-11T15:00:00Z for cart-service in "ecommerce" namespace
anomaly_timestamp = "2026-08-11T15:00:00Z"
anomaly_namespace = "ecommerce"
anomaly_controller = "cart-service"

# K8s events in database:
events = [
    K8sEvent(
        timestamp="2026-08-11T14:55:00Z",  # 5 min before spike
        kind="deployment",
        namespace="ecommerce",  # same namespace
        name="cart-service",
        action="update",
        details={"image": "cart:v2.1", "previous_image": "cart:v2.0"}
    )
]
```

**Expected:**
```python
correlations = [
    Correlation(
        time_delta_seconds=-300,  # event was 300s before spike
        confidence_score=0.92,
        # Breakdown:
        # time_score = 1.0 - (300 / 1800) = 0.833 → × 0.5 = 0.417
        # namespace_score = 1.0 (exact match) → × 0.3 = 0.300
        # event_type_score = 1.0 (deployment) → × 0.2 = 0.200
        # total = 0.417 + 0.300 + 0.200 = 0.917 ≈ 0.92
        explanation="Deployment 'cart-service' was updated (cart:v2.0 → cart:v2.1) 5 minutes before the cost spike"
    )
]
```

---

### TEST 3.2 — No events near spike → UNKNOWN cause

**Input:**
```python
anomaly_timestamp = "2026-08-11T15:00:00Z"
anomaly_namespace = "ecommerce"

# No K8sEvents within ±30 minutes
events = []
```

**Expected:**
```python
correlations = []  # empty list
# Anomaly remains without correlation
# Incident summary should say "No deployment or configuration changes found near the time of the spike"
```

---

### TEST 3.3 — Multiple events near spike → ranked by confidence

**Input:**
```python
anomaly_timestamp = "2026-08-11T15:00:00Z"
anomaly_namespace = "ecommerce"

events = [
    K8sEvent(
        timestamp="2026-08-11T14:55:00Z",  # 5 min before
        kind="deployment",
        namespace="ecommerce",
        name="cart-service",
        action="update",
    ),
    K8sEvent(
        timestamp="2026-08-11T14:40:00Z",  # 20 min before
        kind="configmap",
        namespace="ecommerce",
        name="cart-config",
        action="update",
    ),
    K8sEvent(
        timestamp="2026-08-11T14:58:00Z",  # 2 min before
        kind="deployment",
        namespace="payments",  # DIFFERENT namespace
        name="payment-api",
        action="update",
    ),
]
```

**Expected:**
```python
# Ranked by confidence:
correlations = [
    # 1st: cart-service deployment (same namespace, close in time, deployment type)
    Correlation(confidence_score=0.917, ...),
    # 2nd: payment-api deployment (different namespace but very close in time)
    Correlation(confidence_score=0.789, ...),
    # 3rd: cart-config configmap (same namespace but further in time, lower event type)
    Correlation(confidence_score=0.678, ...),
]
```

---

### TEST 3.4 — Event in wrong namespace → lower confidence

**Input:**
```python
anomaly_timestamp = "2026-08-11T15:00:00Z"
anomaly_namespace = "ecommerce"

events = [
    K8sEvent(
        timestamp="2026-08-11T14:55:00Z",
        kind="deployment",
        namespace="monitoring",  # wrong namespace
        name="prometheus",
        action="update",
    ),
]
```

**Expected:**
```python
correlations = [
    Correlation(
        confidence_score=0.507,
        # time_score = 0.833 → × 0.5 = 0.417
        # namespace_score = 0.3 (no match) → × 0.3 = 0.090
        # event_type_score = 1.0 → × 0.2 = 0.200
        # total = 0.707 ... wait let me recalc
        # Actually: 0.417 + 0.090 + 0.200 = 0.707
    )
]
# Lower confidence than same-namespace match
```

---

### TEST 3.5 — Scaling event after spike → lower than deployment before

**Input:**
```python
anomaly_timestamp = "2026-08-11T15:00:00Z"
anomaly_namespace = "ecommerce"

events = [
    K8sEvent(
        timestamp="2026-08-11T14:57:00Z",  # 3 min BEFORE spike
        kind="deployment",
        namespace="ecommerce",
        name="cart-service",
        action="update",
    ),
    K8sEvent(
        timestamp="2026-08-11T15:05:00Z",  # 5 min AFTER spike
        kind="hpa",
        namespace="ecommerce",
        name="cart-service-hpa",
        action="scale",
    ),
]
```

**Expected:**
```python
# Deployment before spike ranks higher than HPA scale after spike
correlations[0].k8s_event.kind == "deployment"  # ranked first
correlations[0].confidence_score > correlations[1].confidence_score
# The HPA scaling is likely a REACTION to the spike, not the cause
```

---

## DOMAIN 4: INCIDENTS (Creation & Evidence)

### TEST 4.1 — Anomaly with correlation creates full incident

**Input:**
```python
anomaly = Anomaly(
    namespace="ecommerce",
    controller_name="cart-service",
    metric="network_cost_total",
    baseline_value=1.20,
    spike_value=4.80,
    deviation_score=3.0,
    severity="warning",
)

correlation = Correlation(
    k8s_event=K8sEvent(
        kind="deployment", name="cart-service", action="update",
        details={"image": "cart:v2.1"}
    ),
    confidence_score=0.92,
    time_delta_seconds=-300,
    explanation="Deployment 'cart-service' was updated 5 minutes before the cost spike"
)
```

**Expected:**
```python
incident = Incident(
    title="⚠️ WARNING: Network cost spike for ecommerce/cart-service (+300%)",
    severity="warning",
    status="open",
    fingerprint="proj_1:ecommerce:cart-service:network_cost_total",
    evidence={
        "anomaly": {
            "metric": "network_cost_total",
            "baseline_value": 1.20,
            "spike_value": 4.80,
            "deviation_pct": 300.0,
            "method": "pct_change"
        },
        "workload": {
            "namespace": "ecommerce",
            "controller_kind": "deployment",
            "controller_name": "cart-service"
        },
        "correlations": [
            {
                "event_kind": "deployment",
                "event_name": "cart-service",
                "event_action": "update",
                "confidence": 0.92,
                "time_delta_seconds": -300,
                "explanation": "Deployment 'cart-service' was updated 5 minutes before the cost spike",
                "details": {"image": "cart:v2.1"}
            }
        ]
    },
    summary="Network cost for ecommerce/cart-service spiked 300% above baseline ($1.20 → $4.80). Most likely cause: Deployment 'cart-service' was updated 5 minutes before the cost spike (92% confidence)."
)
```

---

### TEST 4.2 — Duplicate fingerprint does NOT create second incident

**Input:**
```python
# Two anomalies for the same workload + metric within short period
anomaly_1 = Anomaly(namespace="ecommerce", controller_name="cart-service", metric="network_cost_total")
anomaly_2 = Anomaly(namespace="ecommerce", controller_name="cart-service", metric="network_cost_total")

# Both generate same fingerprint: "proj_1:ecommerce:cart-service:network_cost_total"
# And there's already an OPEN incident with that fingerprint
```

**Expected:**
- Only 1 `Incident` exists
- Second anomaly is linked to existing incident (or skipped)
- No duplicate alert sent

---

### TEST 4.3 — Status transitions

**Input:**
```python
incident = Incident(status="open")

# PATCH /api/incidents/1/ {"status": "acknowledged"}
# later: PATCH /api/incidents/1/ {"status": "resolved"}
```

**Expected:**
```python
# After acknowledge:
incident.status == "acknowledged"
incident.acknowledged_at is not None

# After resolve:
incident.status == "resolved"
incident.resolved_at is not None
incident.anomaly.is_resolved == True  # back-propagates
```

---

### TEST 4.4 — Incident detail API returns full evidence

**Input:**
```python
# GET /api/incidents/1/
```

**Expected:**
```json
{
    "id": 1,
    "title": "⚠️ WARNING: Network cost spike for ecommerce/cart-service (+300%)",
    "severity": "warning",
    "status": "open",
    "summary": "Network cost for ecommerce/cart-service spiked 300%...",
    "evidence": {
        "anomaly": {"metric": "...", "baseline_value": 1.20, "spike_value": 4.80},
        "workload": {"namespace": "ecommerce", "controller_name": "cart-service"},
        "correlations": [{"confidence": 0.92, "explanation": "..."}]
    },
    "created_at": "2026-08-11T15:00:00Z",
    "acknowledged_at": null,
    "resolved_at": null
}
```

---

## DOMAIN 5: ALERTS (Delivery)

### TEST 5.1 — Slack webhook sends correct payload

**Input:**
```python
alert_rule = AlertRule(
    channel_type="slack",
    channel_config={"webhook_url": "https://hooks.slack.com/services/T00/B00/xxx"},
    severity_filter="",  # all severities
    is_active=True,
)

incident = Incident(
    title="🚨 CRITICAL: Network cost spike for media/image-worker (+600%)",
    severity="critical",
    evidence={...}
)
```

**Expected Slack POST body:**
```json
{
    "blocks": [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": "🚨 Network Cost Spike Detected"}
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": "*Workload:*\nmedia/image-worker"},
                {"type": "mrkdwn", "text": "*Severity:*\n🚨 CRITICAL"}
            ]
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": "*Cost Spike:*\n$80.00 → $560.00 (+600%)"},
                {"type": "mrkdwn", "text": "*Likely Cause:*\nDeployment 'image-worker' updated (92% confidence)"}
            ]
        }
    ]
}
```
- `requests.post` called once with the webhook URL
- `AlertHistory` created with `status="sent"`

---

### TEST 5.2 — Disabled alert rule does NOT send

**Input:**
```python
alert_rule = AlertRule(is_active=False, ...)
incident = Incident(severity="critical")
```

**Expected:**
- `requests.post` NOT called
- 0 `AlertHistory` records created

---

### TEST 5.3 — Severity filter skips non-matching incidents

**Input:**
```python
alert_rule = AlertRule(
    severity_filter="critical",  # only critical
    is_active=True,
)
incident = Incident(severity="warning")  # warning, not critical
```

**Expected:**
- `requests.post` NOT called (severity doesn't match filter)
- 0 `AlertHistory` records

---

### TEST 5.4 — Webhook delivery failure logs error

**Input:**
```python
alert_rule = AlertRule(
    channel_type="slack",
    channel_config={"webhook_url": "https://hooks.slack.com/invalid"},
    is_active=True,
)
# requests.post returns status_code=404, body="no_service"
```

**Expected:**
- 1 `AlertHistory` created with:
  - `status = "failed"`
  - `response_body` contains "404" or "no_service"
- No crash, no exception propagated

---

## DOMAIN 6: END-TO-END PIPELINE

### TEST 6.1 — Full pipeline: ingestion → detection → correlation → incident → alert

**Input (frozen time: 2026-08-11T15:00:00Z):**
```python
# Pre-existing: 7 days of hourly snapshots for "cart-service" at ~$1.20/hr
# Pre-existing: K8sEvent - deployment update at 14:55:00Z

# New OpenCost response arrives with cart-service at $6.00 (5x spike)
```

**Expected chain:**
1. `collect_cost_snapshot` → 1 CostSnapshot, 1 WorkloadCost ($6.00)
2. `detect_anomalies` → 1 Anomaly (warning, 400% deviation)
3. `correlate_anomaly` → 1 Correlation (deployment, ~92% confidence)
4. `create_incident` → 1 Incident with full evidence JSON
5. `send_alert` → 1 Slack POST, 1 AlertHistory(status="sent")

Total records created: 1 snapshot + 1 workload_cost + 1 anomaly + 1 correlation + 1 incident + 1 alert_history = 6 records

---

## DOMAIN 7: API & AUTH

### TEST 7.1 — Valid API key accepted

**Input:**
```http
GET /api/incidents/
X-API-Key: test-api-key-abc123
```

**Expected:** `200 OK` with incident list

---

### TEST 7.2 — Invalid API key rejected

**Input:**
```http
GET /api/incidents/
X-API-Key: wrong-key
```

**Expected:** `403 Forbidden` with `{"detail": "Invalid API key"}`

---

### TEST 7.3 — Missing API key rejected

**Input:**
```http
GET /api/incidents/
# No X-API-Key header
```

**Expected:** `401 Unauthorized` with `{"detail": "API key required"}`

---

### TEST 7.4 — Health endpoint requires no auth

**Input:**
```http
GET /api/health/
# No headers
```

**Expected:** `200 OK` with `{"status": "ok", "version": "0.1.0"}`

---

## Summary

| Domain | Tests | Critical Assertions |
|---|---|---|
| Collector | 5 | Correct parsing, graceful failures, idempotency |
| Detector | 8 | Correct severity, no false positives, handles zero baselines |
| Correlator | 5 | Confidence scoring, ranking, unknown handling |
| Incidents | 4 | Evidence assembly, deduplication, status transitions |
| Alerts | 4 | Correct payloads, filtering, failure logging |
| E2E Pipeline | 1 | Full chain from ingestion to Slack alert |
| API/Auth | 4 | Auth enforcement, health bypass |
| **TOTAL** | **31** | |
