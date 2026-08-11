# Product Boundaries: Network Cost Smoke Detector

## What OpenCost/Kubecost Does (We Don't Rebuild)
We consider OpenCost and Kubecost as foundational accounting layers. We rely on their data or coexist with them. We explicitly **do not** rebuild:
*   Cost accounting per workload (CPU, RAM, Storage).
*   Billing reconciliation and cloud provider invoice ingestion.
*   Long-term budgeting, forecasting, or showback/chargeback reporting.
*   FinOps dashboarding for finance teams.

## What We Do (Our Differentiation)
Our product is an incident response tool for network costs. We provide:
*   **Anomaly Detection on Cost Data:** Real-time or near-real-time detection of unexpected spikes in network egress or cross-AZ traffic.
*   **Deployment → Cost Spike Correlation:** Automatically linking a network cost anomaly to a specific Kubernetes lifecycle event (e.g., `Deployment` update, `ReplicaSet` scale, configuration map change).
*   **Root Cause Identification with Confidence Scoring:** "We are 95% confident that the spike in cross-AZ traffic is due to the rollout of `cart-service` v1.4."
*   **Evidence-Based Incident Reports:** Providing the developer with the specific diff, deployment timestamp, and flow volume changes that prove the hypothesis.
*   **Developer-First Alerting:** Delivering bite-sized, actionable alerts (e.g., via Slack, Teams, or PagerDuty) directly to the engineering team responsible, completely bypassing traditional dashboard interfaces.

## What We Explicitly Don't Do (MVP)
To maintain focus and avoid scope creep, the MVP will **not** include:
*   **Multi-cloud support:** We will target a single major provider (e.g., AWS) initially for pricing accuracy.
*   **Customer/Tenant Attribution:** We map costs to K8s resources (namespaces/deployments), not to end-user SaaS tenants.
*   **ML-based Detection:** We will use deterministic heuristics, standard deviations, and static thresholds for the MVP rather than complex machine learning models.
*   **eBPF Collection:** We will not build our own eBPF sensor. We will ingest metrics from existing observability tools (like Hubble, Prometheus, or OpenCost's DaemonSet).
*   **Payment/Billing:** We do not process invoices or integrate directly with payment APIs.
*   **General Dashboarding:** We are a "smoke detector." If there is no fire, the product should be invisible.

## Our Core Workflow

```
Cost spike detected 
      ↓ 
Detect anomaly (threshold exceeded) 
      ↓ 
Find workload (identify the namespace/pod driving the traffic) 
      ↓ 
Find deployment (query K8s API for recent changes to that workload) 
      ↓ 
Correlate traffic (map the new deployment's start time to the traffic spike) 
      ↓ 
Score confidence (evaluate proximity in time and volume) 
      ↓ 
Show evidence (generate diff and traffic charts) 
      ↓ 
Alert (send notification to developer workflow)
```
