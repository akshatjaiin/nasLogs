# Technical Risks & Mitigation Strategies

This document analyzes technical risks, edge cases, and architectural constraints in building a Sentry-like observability product for cloud network costs.

---

## 1. High-Volume Telemetry & Network Flows

### Risk
Millions of network events/packets generated every minute. Streaming un-aggregated events directly to Django would cause memory exhaustion, DB write bottleneck, and massive network overhead.

### Mitigation Strategy
- **Agent-side Local Aggregation**: The collector agent aggregates flows by `(source_pod, dest_ip, port, zone)` into sliding 1-minute windows.
- **Batching & Compression**: Aggregated metrics are compressed (gzip) and transmitted in fixed batches every 60 seconds.
- **Bounded Buffer**: The agent uses a ring buffer with drop-oldest backpressure if backend ingestion is degraded.

---

## 2. Unknown & Unattributable Traffic

### Risk
Certain network traffic (e.g., cross-AZ cluster system traffic, kube-dns queries, node-to-node probes) cannot be tied to a single user application deployment.

### Mitigation Strategy
- Explicit `UNKNOWN` attribution tag rather than false/guessing attribution.
- Separate system-namespace workloads from tenant-application workloads.
- Explicit `attribution_confidence` metric on all records (e.g., `confidence: 0.95` for exact pod pod-IP match vs `confidence: 0.60` for CIDR subnet match).

---

## 3. Agent Overhead & Traffic Isolation

### Risk
If the agent acts as an inline proxy (e.g., Application → Agent → Internet), agent failure or latency would bring down customer applications.

### Mitigation Strategy
- **Out-of-Band Observation Path**: Customer application traffic takes the normal network routing path (e.g., AWS NAT Gateway / VPC Router).
- **Passive Monitoring**: The collector monitors kernel socket state / VPC flow logs / eBPF traces asynchronously out-of-band.
- **Fail-Safe Design**: If the collector crashes, customer network traffic continues uninterrupted.

---

## 4. NAT Gateway & Elastic IP Attribution Gap

### Risk
AWS NAT Gateway charges $0.045/GB processed + $0.045/hr. Inbound/outbound traffic passing through NAT Gateways loses pod source IP context at the NAT boundary.

### Mitigation Strategy
- Cross-reference pod egress telemetry (local pod IP -> NAT internal IP) with NAT Gateway CloudWatch metrics.
- Correlate time-windowed byte counts from pod network metrics against NAT Gateway billing metrics.

---

## 5. Billing Reconciliation vs Real-Time Estimation

### Risk
Real-time calculated cost estimates may differ from final AWS Cost Explorer CUR (Cost and Usage Report) billing due to volume discounts, free tiers, or complex cross-region pricing.

### Mitigation Strategy
- Maintain clear distinction between `observed_usage` (bytes), `estimated_cost` (rate table lookup), and `reconciled_cost` (AWS CUR billing data).
- Expose variance percentage in dashboard summaries.
