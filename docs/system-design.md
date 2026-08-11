# System Design & Architecture

The Network Cost Smoke Detector is an observability system designed to answer:
> **"Something changed. Which Kubernetes workload caused the network cost spike?"**

---

## 1. High-Level Architecture Diagram

```
Customer Environment:
┌─────────────────────────────────────────────────────────────┐
│  Kubernetes Cluster                                         │
│                                                             │
│   Workload A (cart-service) ───┐                            │
│   Workload B (image-worker) ───┼──> [Egress Traffic Path]   │
│                                │             │              │
│                                │             v              │
│                                │      AWS NAT Gateway       │
│                                │             │              │
│                                v             v              │
│                     ┌────────────────────┐ Internet         │
│                     │ Collector Agent    │                  │
│                     │ (OpenCost API /    │                  │
│                     │  eBPF Telemetry)   │                  │
│                     └─────────┬──────────┘                  │
└───────────────────────────────┼─────────────────────────────┘
                                │
                          HTTP Telemetry (JSON Batches)
                                │
                                v
Central Observability Backend:
┌─────────────────────────────────────────────────────────────┐
│  Django REST Framework API                                  │
│                                                             │
│  ├── Ingestion Engine (Collector Service)                   │
│  ├── Anomaly Detector Engine (Pct-Change / Z-Score)          │
│  ├── Correlation Engine (K8s Events + Time Delta Scorer)    │
│  └── Storage Layer (PostgreSQL / SQLite)                    │
│                                                             │
│  Frontend (Sentry-Inspired SPA)                             │
│  ├── Overview (Scorecards + 24h Cost Trend Chart)           │
│  ├── Cost Incidents List (Sparklines + Filters)             │
│  ├── Incident Detail (Blame Trail Waterfall Timeline)       │
│  └── Cost Breakdown (Collapsible Namespace Tree)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Ingestion & Data Pipeline

1. **Collection**: OpenCost API / Prometheus agent scrapes per-workload egress metrics (`network_cost_total`, `network_cross_zone_cost`, `network_internet_cost`).
2. **Snapshot Creation**: Stores `CostSnapshot` and `WorkloadCost` models in 1-hour window snapshots.
3. **Anomaly Detection**: `AnomalyDetector` evaluates current snapshot against baseline window (e.g. 168 hours). If deviation exceeds threshold (e.g., +200% warning, +500% critical), an `Anomaly` is triggered.
4. **Correlation Engine**: Matches detected anomalies against `K8sEvent` timeline within a ±30 minute window (Deployments, ConfigMaps, HPAs, StatefulSets). Calculates confidence score:
   $$\text{Score} = w_{\text{time}} \cdot S_{\text{time}} + w_{\text{ns}} \cdot S_{\text{ns}} + w_{\text{event}} \cdot S_{\text{event}}$$
5. **Incident Generation**: Deduplicates anomalies into unified `Incident` records with rich structured `evidence` payload.

---

## 3. Data Schema

- `Organization`: Multitenant account grouping.
- `Project`: Kubernetes cluster identifier + OpenCost configuration.
- `CostSnapshot`: Windowed snapshot container with raw response metadata.
- `WorkloadCost`: Per-controller breakdown (namespace, controller_name, egress_bytes, cost_total).
- `AnomalyThreshold`: Metric thresholds, baseline hours, sensitivity parameters.
- `Anomaly`: Triggered outlier with spike value vs baseline value and deviation score.
- `K8sEvent`: Kubernetes audit event (Kind, Action, Details JSON, Timestamp).
- `Correlation`: Link between Anomaly and K8sEvent with calculated confidence score and human-readable explanation.
- `Incident`: Fingerprinted incident container with severity, status, and evidence tree.
