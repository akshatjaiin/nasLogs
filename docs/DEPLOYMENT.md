# Production Deployment & AWS Setup Guide

This guide explains how to deploy **Smoke Detector** into your infrastructure and connect your AWS EC2 instances, EKS Kubernetes clusters, and NAT Gateways for network cost anomaly detection and root cause attribution.

---

## ️ Deployment Overview

```
                                 ┌──────────────────────────────────┐
                                 │   AWS Cloud / Production VPC    │
                                 │                                  │
┌──────────────────────────┐     │  ┌────────────────────────────┐  │
│  Smoke Detector Central  │     │  │  EKS Kubernetes Cluster    │  │
│  Observability Server    │     │  │                            │  │
│  (Django + Postgres +    │◄────┼──┼── Smoke Detector Agent     │  │
│   Web Dashboard)         │     │  │   (DaemonSet / OpenCost)   │  │
└──────────────────────────┘     │  └──────────────┬─────────────┘  │
                                 │                 │ Egress Path    │
                                 │                 v                │
                                 │  ┌────────────────────────────┐  │
                                 │  │  AWS NAT Gateway           │  │
                                 │  └────────────────────────────┘  │
                                 └──────────────────────────────────┘
```

Smoke Detector runs via **out-of-band telemetry collection**. The agent monitors pod egress & network metrics passively without acting as a network proxy or adding latency to application traffic.

---

##  Step 1: Deploy Smoke Detector Central Observability Backend

### Option A: AWS EC2 / VM via Docker Compose (Quickest)

1. Launch an AWS EC2 instance (t3.medium or larger running Ubuntu 22.04 / Amazon Linux 2023).
2. Clone the repository:
   ```bash
   git clone https://github.com/smokedetector/smokedetector.git
   cd smokedetector
   ```
3. Launch services using Docker Compose:
   ```bash
   docker-compose up -d
   ```
4. Access the Sentry-inspired dashboard at `http://<YOUR_EC2_PUBLIC_IP>:3000`.

### Option B: Kubernetes / Helm Deployment

```bash
helm repo add smokedetector https://charts.smokedetector.io
helm install smokedetector-backend smokedetector/backend \
  --namespace smokedetector --create-namespace \
  --set postgresql.enabled=true \
  --set redis.enabled=true
```

---

##  Step 2: Install Agent DaemonSet on Kubernetes Clusters

To collect pod egress metrics & audit events from your Kubernetes clusters (AWS EKS, GKE, self-managed EC2 nodes):

### 1. Apply Agent Manifests

```bash
kubectl apply -f deploy/k8s/agent-daemonset.yaml
```

### 2. Verify Agent Status

```bash
kubectl get daemonset -n smoke-detector
kubectl get pods -n smoke-detector
```

The agent runs passively on every node, collecting windowed network metrics and transmitting compressed 60-second summary batches to your central backend API (`/api/collector/`).

---

## ️ Step 3: Configure AWS NAT Gateway Telemetry (AWS Attribution)

To attribute AWS NAT Gateway data processing fees ($0.045/GB) and cross-AZ traffic back to specific workloads:

### 1. Deploy AWS CloudFormation Stack

Deploy [`deploy/aws/cloudformation.json`](../deploy/aws/cloudformation.json) via AWS Console or CLI:

```bash
aws cloudformation create-stack \
  --stack-name smoke-detector-aws-attribution \
  --template-body file://deploy/aws/cloudformation.json \
  --capabilities CAPABILITY_NAMED_IAM
```

### 2. Configure IAM Policy

The CloudFormation stack grants read-only permission for:
- `cloudwatch:GetMetricData` (NAT Gateway BytesOut / BytesIn)
- `ec2:DescribeNatGateways` & `ec2:DescribeNetworkInterfaces`

---

##  Step 4: Verification & Live Alerting

1. Open the Smoke Detector Dashboard at `http://<SERVER_IP>:3000`.
2. Check the **Setup & Agent Deploy** tab in the sidebar.
3. Select your cluster from the **Project Selector** dropdown (`Acme Corp / Production Cluster (AWS)`).
4. When a workload spikes in egress network cost (e.g. `ecommerce/cart-service` +600%), Smoke Detector will automatically generate a **Blame Trail** showing the exact deployment or config change responsible.

---

##  Step 5: Configure Slack Webhook Alerts

1. Open **Settings / Alert Rules** in the dashboard.
2. Add your Slack Incoming Webhook URL:
   `https://hooks.slack.com/services/T00/B00/X00`
3. Save rule. Critical cost spikes will automatically post formatted Slack messages with Blame Trail links.
