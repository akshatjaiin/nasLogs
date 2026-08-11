export async function renderDocs(container) {
    const defaultDsn = 'http://nas_live_9f8a37b120c94e82b7@localhost:8000/api/collector/v1/ingest/1';

    container.innerHTML = `
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Sentry-Style 1-Click Onboarding</h1>
                <p class="page-subtitle">Start receiving real-time network cost telemetry in less than 60 seconds</p>
            </div>

            <!-- Tabbed Quick Start Wizard -->
            <div class="panel" style="margin-bottom:var(--space-xl)">
                <div style="display:flex;gap:var(--space-md);border-bottom:1px solid var(--border-primary);padding-bottom:var(--space-md);margin-bottom:var(--space-lg)">
                    <button class="filter-pill active" id="tab-helm">Helm Chart (Recommended)</button>
                    <button class="filter-pill" id="tab-kubectl">Kubectl 1-Liner</button>
                    <button class="filter-pill" id="tab-python">Python SDK</button>
                </div>

                <!-- Helm Code Tab -->
                <div id="content-helm">
                    <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                        Run this single command in your terminal to deploy the lightweight NAS Logs eBPF collector DaemonSet:
                    </p>
                    <div class="code-block" style="background:var(--bg-primary);padding:var(--space-lg);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--text-xs);position:relative;border:1px solid var(--border-primary)">
                        <button class="btn btn-ghost btn-copy-cmd" data-target="helm-cmd" style="position:absolute;top:10px;right:10px;height:28px">Copy Command</button>
                        <code id="helm-cmd">helm repo add naslogs https://charts.naslogs.com/charts && helm install nas-agent naslogs/agent --set dsn="${defaultDsn}"</code>
                    </div>
                </div>

                <!-- Kubectl Code Tab -->
                <div id="content-kubectl" style="display:none">
                    <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                        One-line automated shell script installer for Kubernetes:
                    </p>
                    <div class="code-block" style="background:var(--bg-primary);padding:var(--space-lg);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--text-xs);position:relative;border:1px solid var(--border-primary)">
                        <button class="btn btn-ghost btn-copy-cmd" data-target="kubectl-cmd" style="position:absolute;top:10px;right:10px;height:28px">Copy Command</button>
                        <code id="kubectl-cmd">curl -sL https://raw.githubusercontent.com/akshatjaiin/nasLogs/testing/deploy/k8s/install.sh | DSN="${defaultDsn}" sh</code>
                    </div>
                </div>

                <!-- Python SDK Tab -->
                <div id="content-python" style="display:none">
                    <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                        For custom app-level egress telemetry or Lambda functions:
                    </p>
                    <div class="code-block" style="background:var(--bg-primary);padding:var(--space-lg);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--text-xs);position:relative;border:1px solid var(--border-primary)">
                        <button class="btn btn-ghost btn-copy-cmd" data-target="python-cmd" style="position:absolute;top:10px;right:10px;height:28px">Copy Code</button>
                        <code id="python-cmd">pip install nas-logs

from nas_logs import NASLogsClient
client = NASLogsClient(dsn="${defaultDsn}")
client.track_egress(namespace="media", controller="image-worker", egress_bytes=1073741824)</code>
                    </div>
                </div>
            </div>

            <!-- Verification Status Card -->
            <div class="panel">
                <h3 class="section-title">Telemetry Connection Status</h3>
                <div style="display:flex;align-items:center;gap:var(--space-md);margin-top:var(--space-md)">
                    <span style="color:var(--success-content);font-size:18px" class="pulse-dot">●</span>
                    <div>
                        <strong style="color:var(--text-heading)">Agent Handshake Verified</strong>
                        <p style="font-size:var(--text-xs);color:var(--text-secondary)">Receiving telemetry snapshots from Production Cluster (AWS)</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Tab switching logic
    const helmTab = document.getElementById('tab-helm');
    const kubectlTab = document.getElementById('tab-kubectl');
    const pythonTab = document.getElementById('tab-python');
    const helmContent = document.getElementById('content-helm');
    const kubectlContent = document.getElementById('content-kubectl');
    const pythonContent = document.getElementById('content-python');

    helmTab?.addEventListener('click', () => {
        helmTab.classList.add('active'); kubectlTab.classList.remove('active'); pythonTab.classList.remove('active');
        helmContent.style.display = 'block'; kubectlContent.style.display = 'none'; pythonContent.style.display = 'none';
    });
    kubectlTab?.addEventListener('click', () => {
        kubectlTab.classList.add('active'); helmTab.classList.remove('active'); pythonTab.classList.remove('active');
        kubectlContent.style.display = 'block'; helmContent.style.display = 'none'; pythonContent.style.display = 'none';
    });
    pythonTab?.addEventListener('click', () => {
        pythonTab.classList.add('active'); helmTab.classList.remove('active'); kubectlTab.classList.remove('active');
        pythonContent.style.display = 'block'; helmContent.style.display = 'none'; kubectlContent.style.display = 'none';
    });

    // Copy command buttons
    container.querySelectorAll('.btn-copy-cmd').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const text = document.getElementById(targetId)?.innerText;
            if (text) {
                navigator.clipboard.writeText(text);
                btn.innerText = 'Copied!';
                setTimeout(() => { btn.innerText = 'Copy'; }, 2000);
            }
        });
    });

    if (window.lucide) window.lucide.createIcons();
}
