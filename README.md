# 🦺 Smoke Detector — Network Cost Observability & Root-Cause Attribution

> **Sentry-inspired incident response for Kubernetes cloud network costs.**

![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)
![Django 5.1](https://img.shields.io/badge/django-5.1-green.svg)
![Tests](https://img.shields.io/badge/tests-36%2F36%20passing-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)

---

## 💡 Why We Built This

Traditional tools like **Kubecost** or **OpenCost** answer:
> *"How much network cost does this workload accumulate?"*

When a sudden $5,000 egress spike hits your AWS bill, engineers want to know:
> **"Something changed. What caused the cost spike, and who pushed it?"**

**Smoke Detector** bridges the gap between Kubernetes network telemetry and infrastructure deployment history. It detects network cost anomalies, correlates them against Kubernetes audit events within temporal windows, and generates actionable **Blame Trails** with confidence scores.

---

## ✨ Key Features

- **🎯 Blame Trail (Waterfall Timeline)**: Visualizes network cost spikes alongside correlated Kubernetes events (Deployments, ConfigMaps, HPAs, StatefulSets) within a $\pm 30$-minute window.
- **⚡ Anomaly Detection Engine**: Supports both Percentage Change ($\Delta\%$) and statistical Z-score algorithms with configurable baseline windows (default 7 days / 168 hours).
- **🧠 Correlation & Confidence Scoring**: Scores candidate Kubernetes events using weighted temporal delta, namespace isolation, and event type significance.
- **📊 Sentry-Inspired Dark UI**: Pure Vanilla JS + Chart.js frontend featuring 24h cost trend area charts, inline workload sparklines, and hierarchical namespace drill-down trees.
- **🔔 Slack Alerts**: Formatted webhook alerts delivering structured evidence payloads and link-backs to the incident dashboard.
- **🛡️ Out-of-Band & Safe**: Does not sit in the traffic path. Telemetry collection runs passively with zero latency penalty or risk to production workloads.

---

## 🏗️ System Architecture

```
Kubernetes Workloads
        │
        ▼ (Passive Egress Telemetry)
┌─────────────────────────────────┐
│ OpenCost / Prometheus Collector │
└────────────────┬────────────────┘
                 │ HTTP Telemetry Snapshots
                 ▼
┌─────────────────────────────────┐
│ Django REST Framework Backend   │
│                                 │
│  ├── Ingestion Engine           │
│  ├── Anomaly Detector           │
│  ├── Correlation Engine         │
│  └── Incident Store             │
└────────────────┬────────────────┘
                 │ REST API (JSON)
                 ▼
┌─────────────────────────────────┐
│ Sentry-Inspired Dashboard (SPA) │
│                                 │
│  ├── Overview & Trend Charts    │
│  ├── Cost Incidents & Sparklines│
│  ├── Blame Trail Waterfall      │
│  └── Cost Breakdown Tree        │
└─────────────────────────────────┘
```

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.12+
- Node.js / web browser (no build steps required for the frontend)

### 1. Clone & Set Up Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed database with 7 days (168h) of realistic cost history & demo incidents
python manage.py seed_demo

# Start Django backend server
python manage.py runserver 8000
```

### 2. Launch Frontend UI

In a second terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Start lightweight local server
python -m http.server 3000
```

Open **`http://localhost:3000`** in your browser!

---

## 🧪 Running the Test Suite

Smoke Detector includes a comprehensive test suite covering ingestion, anomaly detection, correlation scoring, incident state management, and alert backends.

```bash
cd backend
pytest
```

Output:
```text
======================== 36 passed in 1.42s ========================
```

---

## 📊 Dashboard Overview

- **Overview Dashboard (`/#/`)**: High-level KPIs, 24-hour cost trend area chart, and recent critical alerts.
- **Cost Incidents (`/#/incidents`)**: Searchable, filterable list of open/acknowledged/resolved cost anomalies with inline sparkline charts.
- **Incident Detail (`/#/incidents/:id`)**: **The Blame Trail view** — waterfall timeline matching cost spikes against deployment changes, accompanied by 3-column evidence cards.
- **Cost Breakdown (`/#/breakdown`)**: Namespace-to-controller tree view with 7-day cost deltas and horizontal breakdown charts.

---

## 📚 Documentation

Detailed architectural and design documents are available in the [`docs/`](docs/) directory:

- [`docs/research.md`](docs/research.md) — Market analysis & technical foundations
- [`docs/sentry-study.md`](docs/sentry-study.md) — Sentry architectural patterns & takeaways
- [`docs/system-design.md`](docs/system-design.md) — Ingestion pipeline & database schema
- [`docs/technical-risks.md`](docs/technical-risks.md) — High-cardinality telemetry & NAT attribution risk analysis
- [`docs/test-plan.md`](docs/test-plan.md) — Comprehensive test specification matrix
- [`docs/test-report.md`](docs/test-report.md) — Automated test verification summary
- [`docs/MVP-status.md`](docs/MVP-status.md) — Functional status & roadmap

---

## 📄 License

MIT License — see [`LICENSE`](LICENSE) for details.
