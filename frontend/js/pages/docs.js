export function renderDocs(container) {
    container.innerHTML = `
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Infrastructure Setup & Agent Deployment Guide</h1>
                <p class="page-subtitle">Connect your Kubernetes clusters & AWS cloud infrastructure to Smoke Detector</p>
            </div>

            <div class="grid-3" style="margin-bottom:var(--space-2xl)">
                <div class="score-card">
                    <div class="card-label">Step 1: Cluster Agent</div>
                    <div class="card-value" style="font-size:var(--text-lg)">Kubernetes Helm / DaemonSet</div>
                    <div class="card-trend" style="color:var(--accent-content)">Scrapes pod network metrics out-of-band</div>
                </div>
                <div class="score-card">
                    <div class="card-label">Step 2: AWS Attribution</div>
                    <div class="card-value" style="font-size:var(--text-lg)">NAT Gateway / Flow Logs</div>
                    <div class="card-trend" style="color:var(--accent-content)">Correlates Egress IP byte streams</div>
                </div>
                <div class="score-card">
                    <div class="card-label">Step 3: Verification</div>
                    <div class="card-value" style="font-size:var(--text-lg)">Live Anomaly Detection</div>
                    <div class="card-trend" style="color:var(--success-content)">✓ Automated Blame Trail generation</div>
                </div>
            </div>

            <div class="panel" style="margin-bottom:var(--space-xl)">
                <div class="panel-header">
                    <h3 class="panel-title">📦 Option A: One-Command Helm Deployment (Recommended)</h3>
                </div>
                <div class="panel-body">
                    <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                        Deploy the passive OpenCost / Prometheus agent into your EKS / GKE / Kubernetes cluster.
                        The agent runs out-of-band as a lightweight DaemonSet (CPU &lt; 0.05 cores, Memory &lt; 32MB).
                    </p>
                    <pre style="background:var(--bg-app);padding:var(--space-md);border-radius:var(--radius-md);border:1px solid var(--border-primary);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--accent-content);overflow-x:auto"><code>helm repo add smoke-detector https://charts.smokedetector.io
helm repo update

helm install smoke-detector-agent smoke-detector/agent \\
  --namespace smoke-detector --create-namespace \\
  --set backend.url="http://localhost:8000/api" \\
  --set cluster.name="production-aws-us-east-1" \\
  --set collector.interval="60s"</code></pre>
                </div>
            </div>

            <div class="panel" style="margin-bottom:var(--space-xl)">
                <div class="panel-header">
                    <h3 class="panel-title">⚙️ Option B: Kubernetes DaemonSet Manifest</h3>
                </div>
                <div class="panel-body">
                    <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                        Apply the pre-configured OpenCost & eBPF network telemetry daemonset directly via <code>kubectl</code>:
                    </p>
                    <pre style="background:var(--bg-app);padding:var(--space-md);border-radius:var(--radius-md);border:1px solid var(--border-primary);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-primary);overflow-x:auto"><code>kubectl apply -f https://raw.githubusercontent.com/smokedetector/smokedetector/main/deploy/k8s/agent-daemonset.yaml</code></pre>
                </div>
            </div>

            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">☁️ AWS CloudWatch & NAT Gateway Integration</h3>
                </div>
                <div class="panel-body">
                    <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                        To map cross-AZ and NAT Gateway egress costs ($0.045/GB) back to specific pod workloads, attach the read-only AWS IAM policy:
                    </p>
                    <pre style="background:var(--bg-app);padding:var(--space-md);border-radius:var(--radius-md);border:1px solid var(--border-primary);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-secondary);overflow-x:auto"><code>{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData",
        "ec2:DescribeNatGateways",
        "ec2:DescribeNetworkInterfaces"
      ],
      "Resource": "*"
    }
  ]
}</code></pre>
                </div>
            </div>
        </div>
    `;
}
