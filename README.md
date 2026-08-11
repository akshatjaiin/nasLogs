#  NAS Logs — Sentry for Network Costs & Egress Attribution

> **Sentry-inspired root-cause attribution and incident response for cloud network costs.**

![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)
![Django 5.1](https://img.shields.io/badge/django-5.1-green.svg)
![Tests](https://img.shields.io/badge/tests-40%2F40%20passing-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)

---

##  Why We Built NAS Logs

Traditional cloud cost tools like **Kubecost** or **OpenCost** answer:
> *"How much network cost does this workload accumulate?"*

When a sudden $5,000 egress spike hits your AWS bill, engineers want to know:
> **"Something changed. What caused the cost spike, and who pushed it?"**

**NAS Logs** bridges the gap between Kubernetes network telemetry and infrastructure deployment history. It detects network cost anomalies, correlates them against Kubernetes audit events within temporal windows, and generates actionable **Blame Trails** with confidence scores.

---

##  Key Features

- ** Blame Trail (Waterfall Timeline)**: Visualizes network cost spikes alongside correlated Kubernetes events (Deployments, ConfigMaps, HPAs, StatefulSets) within a $\pm 30$-minute window.
- ** Anomaly Detection Engine**: Supports both Percentage Change ($\Delta\%$) and statistical Z-score algorithms with configurable baseline windows (default 7 days / 168 hours).
- ** Correlation & Confidence Scoring**: Scores candidate Kubernetes events using weighted temporal delta, namespace isolation, and event type significance.
- ** Sentry DSN Telemetry Ingestion (`/api/collector/v1/ingest/<project_id>/`)**: Ingests workload egress metrics using Project DSN keys, auto-calculates statistical anomalies, and creates fingerprinted incidents.
- ** Sentry-Inspired UI & Project Picker**: Clean HTML5 SPA frontend featuring multi-project switcher (`Acme Corp / Production Cluster (AWS)`), 24h cost trend area charts, inline workload sparklines, interactive telemetry history drawers, and hierarchical namespace breakdown trees.
- ** Slack Alerts**: Formatted webhook alerts delivering structured evidence payloads and link-backs to the incident dashboard.
- **️ Out-of-Band & Safe**: Does not sit in the traffic path. Telemetry collection runs passively with zero latency penalty or risk to production workloads.

---

##  Self-Hosted 1-Click Setup (Docker Compose)

Anyone can spin up the full production stack (PostgreSQL + Redis + Django Web API + Celery Worker + Celery Beat + NGINX Web UI) in 30 seconds:

```bash
# 1. Clone repository
git clone https://github.com/akshatjaiin/nasLogs.git
cd nasLogs

# 2. Launch full self-hosted production stack with Docker Compose
docker compose up -d
```

Open **`http://localhost:3000`** in your browser!

- **Web Dashboard**: `http://localhost:3000`
- **Django REST API**: `http://localhost:8000/api/`
- **DSN Telemetry Ingestion**: `http://nas_live_9f8a37b120c94e82b7@localhost:8000/api/collector/v1/ingest/1/`

---

## ️ Local Development Setup (Manual)

### 1. Clone & Set Up Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver 8000
```

### 2. Launch Frontend SPA Server

```bash
cd frontend
python server.py 3001
```

Open **`http://localhost:3001`** in your browser. All SPA routes (`/alerts`, `/settings`, `/incidents`) automatically resolve cleanly without 404s.

---

##  DSN Telemetry Ingestion (Sentry-Style)

Send workload telemetry batches directly to your project DSN:

```bash
curl -X POST http://localhost:8000/api/collector/v1/ingest/1/ \
  -H "Content-Type: application/json" \
  -H "X-Project-Key: test-api-key-abc123" \
  -d '{
    "workloads": [
      {
        "namespace": "media",
        "controller_name": "image-worker",
        "network_cost_total": 82.41,
        "network_egress_bytes": 107374182400,
        "cross_zone_cost": 12.30,
        "internet_cost": 70.11
      }
    ]
  }'
```

Response:
```json
{
  "status": "success",
  "project": "Production Cluster (AWS)",
  "snapshot_id": 172,
  "workloads_ingested": 1,
  "anomalies_detected": 1,
  "incidents_created": [1]
}
```

---

##  CI/CD Automated Testing (GitHub Actions)

NAS Logs includes 40 automated test cases running on **GitHub Actions CI** on every `git push`:

- **Workload Ingestion & OpenCost HTTP Client Parsing**
- **Percentage Change & Z-Score Statistical Anomaly Engine**
- **K8s Event Temporal Correlation & Confidence Weighting**
- **Deterministic Incident Fingerprinting & Deduplication**
- **Slack Webhook Formatting & Delivery Failure Handlers**

---

##  Documentation

Detailed architectural design documents are available in the [`docs/`](docs/) directory:

- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Production AWS & EKS installation guide
- [`docs/research.md`](docs/research.md) — Market analysis & technical foundations
- [`docs/sentry-study.md`](docs/sentry-study.md) — Sentry architectural patterns & takeaways
- [`docs/system-design.md`](docs/system-design.md) — System architecture, data flow, and DB schema
- [`docs/technical-risks.md`](docs/technical-risks.md) — High-cardinality telemetry & NAT attribution risk analysis
- [`docs/test-plan.md`](docs/test-plan.md) — Comprehensive test specification matrix
- [`docs/test-report.md`](docs/test-report.md) — Automated test verification summary
- [`docs/MVP-status.md`](docs/MVP-status.md) — Functional status & roadmap

---

##  License

MIT License — see [`LICENSE`](LICENSE) for details.
