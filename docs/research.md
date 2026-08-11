# Network Cost Smoke Detector: Competitive Research & Landscape

## Existing Products and Projects

### OpenCost
*   **Capabilities & APIs:** Vendor-neutral open-source engine for Kubernetes cost allocation. Supports tracking cluster asset costs (compute, memory, storage, and network egress) and resource usage costs. Provides Prometheus-based reporting.
*   **Limitations:** Primarily acts as a standardized framework for baseline accounting rather than a proactive anomaly detection tool. Network cost attribution requires complex custom metric mapping or external integrations to accurately map to individual pods, and it lacks out-of-the-box incident response or "smoke detector" alerts.

### Kubecost (now IBM)
*   **Features:** Enterprise platform built on OpenCost. Includes a Network Costs DaemonSet for granular pod-level visibility (rx/tx bytes) and a topology map for visualizing traffic flows.
*   **Network Monitoring & Pricing:** Ties Kubernetes metrics to cloud provider billing APIs. Shows cross-AZ and egress costs.
*   **Gaps:** While it can show you *where* money is being spent via dashboards and topology maps, it lacks automated root-cause extraction tied to specific deployment events. It’s a FinOps dashboard, not an automated incident detector.

### CloudZero
*   **Approach:** SaaS cost-intelligence platform that merges K8s usage with broader cloud billing. Uses machine learning to detect cost anomalies globally or by specific views/namespaces.
*   **Strengths:** Good at routing anomalies to the relevant engineering teams and tying infrastructure usage to business dimensions.
*   **Gaps:** Focuses heavily on broad billing anomalies rather than deep, K8s-native deployment correlation. It detects the spike but relies on generic AI hub insights rather than a deterministic link to "Deployment X caused Traffic Y."

### Vantage
*   **Approach:** Granular FinOps platform using a `vantage-network-collector` DaemonSet reading Linux `conntrack` data.
*   **Strengths:** Excellent visibility into cross-AZ and intra-region traffic, directly joining pod-level bytes with cloud provider pricing.
*   **Gaps:** Like Kubecost, it focuses on showback/chargeback and high-level budgeting. It lacks real-time traffic smoke detection tied to specific code or infrastructure rollout events.

### CAST AI
*   **Network Cost Features:** Uses the Kvisor agent (eBPF-powered) to capture network flow data and identify cross-AZ or ingress/egress expenses.
*   **Gaps:** CAST AI's primary mission is automated node provisioning and right-sizing. Network cost is a supplementary feature used to suggest architectural changes (like moving workloads to the same AZ), not a primary incident response mechanism.

### Cilium / Hubble
*   **Approach:** Provides deep, kernel-level network observability using eBPF.
*   **Strengths:** Granular flow data, identity-aware metrics (ties IPs to K8s namespaces/pods), protocol-level insights (L7/L4).
*   **Gaps:** It is an observability and security tool, not a cost tool. It provides the necessary telemetry (bytes, flows, identities) but requires external correlation to calculate cost spikes or detect financial anomalies.

### AWS Cost Explorer & VPC Flow Logs
*   **What they provide:** AWS Cost Explorer gives a high-level view of account spend. VPC Flow Logs provide low-level IP-to-IP byte transfers.
*   **Gaps:** VPC Flow Logs are notoriously expensive to store/query and lack K8s context (they see Node IPs, not Pod identities, especially in non-VPC-native CNI setups). Cost Explorer has a 24-48 hour delay, making it useless for real-time "smoke detection."

### Prometheus
*   **Network Metrics:** Collects raw node and pod network metrics (e.g., `container_network_receive_bytes_total`, `container_network_transmit_bytes_total`).
*   **Gaps:** Only provides raw byte counts. No context on the destination (e.g., is this traffic going to an expensive cross-AZ node or a cheap intra-node sidecar?), and no translation to actual currency costs.

---

## Gap Analysis

1.  **What already exists for network cost monitoring?**
    *   Dashboards that show network costs by namespace (Kubecost, Vantage).
    *   eBPF tools that show network flows and bytes (Hubble, CAST AI).
    *   General cloud cost anomaly detection (CloudZero).
2.  **What does each tool do well?**
    *   OpenCost/Kubecost are great at historical accounting and chargeback.
    *   Hubble is excellent at low-overhead, real-time packet observability.
    *   CloudZero is great at alerting on top-level billing spikes.
3.  **What is missing?**
    *   **Real-time K8s context:** Tying a sudden spike in cross-AZ traffic cost directly back to a `kubectl apply` or Helm deployment event.
    *   **Evidence-based Root Cause:** Existing tools tell you "Namespace A spent $500." They don't say "Deployment A caused a 400% spike in cross-AZ traffic 5 minutes after version 2.1 was rolled out. Here is the diff."
    *   **Developer-First Alerting:** Engineers don't want to look at FinOps dashboards. They want a Slack alert that says "Your recent deployment is burning money, revert it."
4.  **Why hasn't anyone built this specific "smoke detector" product?**
    *   *Assumption:* The disciplines are siloed. FinOps teams buy Kubecost/CloudZero to reconcile bills (lagging indicator). Platform teams use Hubble/Prometheus for availability/latency (real-time, but cost-blind). Bridging real-time network states with financial impact and CI/CD events is a cross-disciplinary problem.
5.  **What would differentiate our product?**
    *   We don't do accounting; we do *incident response* for costs. We are the pager, not the ledger. We correlate network state changes with Kubernetes control plane events (Deployments, ReplicaSets) to provide immediate, actionable root cause analysis.

---

## Technical Landscape

*   **How Network Cost Attribution Works in K8s Today:**
    To accurately bill network traffic, a system must capture the source Pod, the destination IP, resolve the destination to an AZ/Region/Internet, count the bytes, and multiply by the provider's rate card.
*   **eBPF vs Flow Logs vs Prometheus:**
    *   *eBPF (Hubble, Kvisor):* Gold standard. Low overhead, captures exact flows, can tie packets directly to cgroups/pod identities.
    *   *Flow Logs:* Cloud-provider level. High latency, misses pod-level context if IP masquerading is used.
    *   *Prometheus (cAdvisor):* Easiest to access, but lacks destination context. Good for generic volume spikes, useless for pinpointing *why* egress costs increased.
*   **Known Hard Problems:**
    *   **hostNetwork / NAT:** Pods sharing the host network namespace obscure their traffic. SNAT (Source NAT) at the node boundary makes it hard for external observers to know which pod initiated a flow.
    *   **Encrypted Traffic:** While eBPF can see the flow bytes and IPs, deep packet inspection (e.g., knowing exactly which S3 bucket is being queried) is impossible without integrating with TLS libraries or service meshes.
    *   **IP Churn:** Pods are ephemeral. If you don't map an IP to a pod *at the exact time the flow occurred*, the cost attribution will be orphaned.
