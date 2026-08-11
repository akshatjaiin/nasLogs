# OpenCost Study & Research Notes

## OpenCost Architecture
OpenCost provides a real-time cost monitoring and allocation engine for Kubernetes. At its core, the architecture consists of:
1. **Cost Model Engine:** Consumes resource usage metrics (CPU, RAM, Storage, Network) and maps them to cluster entities (Pods, Namespaces, Deployments) using Kubernetes metadata.
2. **Pricing Engine:** Connects to cloud provider billing APIs (AWS, GCP, Azure, custom) to retrieve unit costs for resources.
3. **Allocation Engine:** Allocates the computed costs to the respective workloads. It supports proportional sharing of idle capacity and shared resources.

**Directory Structure Highlights:**
- `pkg/costmodel/`: Contains the core cost model engine (`costmodel.go`), API routers (`router.go`, `handlers.go`, `aggregation.go`), and network cost calculations (`networkcosts.go`).
- `core/pkg/opencost/`: Internal domain models (`allocation.go`, `summaryallocation.go`), definitions for metrics, and network insight logic.
- `modules/prometheus-source/pkg/prom/`: Logic to query Prometheus for metrics (`metricsquerier.go`).
- `pkg/cloud/`: Cloud provider integrations for pricing data.

## Network Cost Calculation (MOST IMPORTANT)
Network costs in OpenCost are primarily egress costs. They are computed by identifying traffic boundaries and applying cloud pricing rates. 

**Calculation Logic:**
OpenCost splits network traffic into different egress categories:
- `NetworkZoneEgress`: Traffic crossing availability zones but within the same region.
- `NetworkRegionEgress`: Traffic crossing regions.
- `NetworkInternetEgress`: Traffic leaving the cloud provider to the internet.
- `NetworkNatGatewayEgress` / `NetworkNatGatewayIngress`: Traffic flowing through a NAT Gateway.

The engine queries Prometheus for metric `kubecost_pod_network_egress_bytes_total` and filters based on labels like `internet="false", same_zone="false", same_region="true"` to categorize the traffic. The byte counts are divided by $1024^3$ to get GiB, then multiplied by the cloud provider's per-GiB pricing (e.g., `pricing.ZoneNetworkEgressCost`) (`pkg/costmodel/networkcosts.go:GetNetworkCost`).

**The DaemonSet (`network-costs`):**
To get node and pod-level network metrics, OpenCost relies on the external `network-costs` DaemonSet (often deployed alongside it). This DaemonSet uses mechanisms like eBPF or conntrack to monitor active connections, map IPs to pods, determine traffic destinations (inter-zone, inter-region, internet), and expose these as Prometheus metrics.

**Granularity & Extraction for Anomaly Detection:**
The metrics are grouped by `(pod_name, namespace, uid)`. For anomaly detection, we can extract cost spikes down to the individual Pod and Namespace level for a specific egress category (e.g., "Internet Egress spiked for pod X").

## APIs We Will Consume
OpenCost exposes several REST endpoints that we can query to extract allocation and cost data over time.

### 1. `/allocation/compute`
The primary endpoint for retrieving cost allocations for workloads.
- **Method:** `GET`
- **Query Parameters:**
  - `window` (required): Time range (e.g., `1d`, `7d`, `2023-01-01T00:00:00Z,2023-01-02T00:00:00Z`).
  - `aggregate` (optional): Comma-separated fields to group by (e.g., `namespace`, `deployment`, `pod`, `label:app`).
  - `step` (optional): Granularity of the returned data (e.g., `1h`, `1d`). Returns an array of windows if specified.
  - `filter` (optional): Filter syntax to scope down results.
  - `includeIdle` (optional): Boolean to include idle cluster costs.
- **Response Format:** Returns an `AllocationSetRange`, which is a list of objects containing a time window and a map of workloads to their `Allocation` (includes `networkCost`, `cpuCost`, `ramCost`, etc.).

### 2. `/allocation/compute/summary`
Similar to `/allocation/compute` but returns a flattened `SummaryAllocation` structure without deep details, useful for lighter payloads.

### 3. `/costDataModel`
Returns internal cost data models.
- **Method:** `GET`
- **Query Parameters:** `timeWindow`, `offset`, `filterFields`, `namespace`.

## Prometheus Metrics
OpenCost both consumes and exposes Prometheus metrics.

**Consumed from Prometheus:**
- Workload Identification: `kube_pod_owner`, `kube_replicaset_owner`, `kube_pod_labels`, `kube_pod_info` (via kube-state-metrics).
- Resource Usage: `container_cpu_usage_seconds_total`, `container_memory_working_set_bytes`.
- **Network Specific:**
  - `kubecost_pod_network_egress_bytes_total`
  - `kubecost_pod_network_ingress_bytes_total`
  (Labels include `internet`, `same_zone`, `same_region`, `nat_gateway`, `pod_name`, `namespace`).

**Exposed by OpenCost:**
- `node_cpu_hourly_cost`, `node_ram_hourly_cost`, etc.
- Allocation metrics (if configured to export).

For anomaly detection baselining, we can directly query `kubecost_pod_network_egress_bytes_total` from Prometheus or query the `/allocation/compute` endpoint with a `1h` step to build historical baselines.

## Kubernetes Metadata
OpenCost maps raw metrics to workloads by joining usage metrics with `kube-state-metrics` data.
- **Pod to Controller:** It uses `kube_pod_owner` to find the owner of a pod (e.g., ReplicaSet, DaemonSet).
- **ReplicaSet to Deployment:** It uses `kube_replicaset_owner` to map ReplicaSets up to Deployments or Rollouts.
- **Labels & Annotations:** It joins `kube_pod_labels` and `kube_namespace_labels` to allow aggregation by arbitrary tags (`aggregate=label:app`).

## Limitations (Where Our Product Fills the Gap)
While OpenCost is excellent at attributing bytes to dollars and mapping them to pods, it lacks deep diagnostic context for incident response:

1. **Missing Destination Details:** OpenCost tells you *that* a pod spent $50 on Internet Egress, but it does **not** tell you *where* that traffic went (e.g., an external API, an S3 bucket, a compromised IP). Our product needs to augment this with layer 4/7 observability or flow logs to identify the destination.
2. **No Deployment/Event History:** OpenCost does not track *why* a spike happened (e.g., "Deployment v2.1 was rolled out at 2:00 PM, causing the spike"). We need to overlay Kubernetes events, CI/CD pipeline events, and git history.
3. **No Automated Anomaly Detection:** OpenCost is a reporting tool. It doesn't proactively alert you that a $10/day workload suddenly started burning $100/day.
4. **Root Cause Correlation:** OpenCost cannot correlate a network spike with application logs (e.g., an infinite retry loop in code).

## Summary
To build the "Network Cost Smoke Detector", we will poll the OpenCost `/allocation/compute` API with `aggregate=namespace,deployment` and `step=1h` to track network costs. When a spike is detected, we will query our own datastores (traffic flows, k8s events, application deployments) to automatically generate a root cause analysis report.
