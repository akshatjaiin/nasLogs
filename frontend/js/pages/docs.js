import { api } from '../api.js';

export async function renderDocs(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:500px;margin:24px"></div></div>`;

    async function renderWizard() {
        let projectId = window.currentProjectId || '1';
        let settings = { dsn: 'Loading DSN...', api_key: '', name: 'Default Project' };
        try {
            settings = await api.getProjectSettings(projectId);
        } catch (e) {
            console.warn('Could not load project settings:', e);
        }

        const projectApiKey = settings.api_key || 'test-api-key-abc123';
        const projectDsn = settings.dsn || `http://${projectApiKey}@localhost:8000/api/collector/v1/ingest/${projectId}`;

        const curlSnippet = `curl -X POST http://localhost:8000/api/collector/v1/ingest/${projectId}/ \\
  -H "Content-Type: application/json" \\
  -H "X-Project-Key: ${projectApiKey}" \\
  -d '{
    "workloads": [
      {
        "namespace": "production",
        "controller_name": "kafka-connect",
        "network_cost_total": 142.80,
        "network_egress_bytes": 182749102948,
        "cross_zone_cost": 28.50,
        "internet_cost": 114.30
      }
    ]
  }'`;

        const helmSnippet = `helm repo add gresstrace https://charts.gresstrace.com/charts && helm install gresstrace-agent gresstrace/agent --set dsn="${projectDsn}"`;
        const pythonSnippet = `pip install gresstrace

from gresstrace import GressTraceClient

client = GressTraceClient(dsn="${projectDsn}")
client.track_egress(namespace="production", controller="kafka-connect", egress_bytes=182749102948)`;

        container.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">GressTrace DSN Setup & Live Telemetry Wizard</h1>
                    <p class="page-subtitle">Generate project DSN keys, configure telemetry collectors, and verify live egress ingestion</p>
                </div>

                <!-- STEP 1: DSN Key & Generation Panel -->
                <div class="panel" style="margin-bottom:var(--space-xl);padding:var(--space-xl)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md)">
                        <div>
                            <span class="severity-badge open" style="background:var(--accent-surface);color:var(--accent-content);margin-bottom:4px;display:inline-block">Step 1 of 3</span>
                            <h3 class="section-title" style="margin:0">Project DSN & Authentication Key</h3>
                        </div>
                        <button class="btn btn-ghost" id="btn-regen-dsn-wizard" style="height:34px;font-size:var(--text-xs)">
                            🔑 Regenerate DSN Key
                        </button>
                    </div>
                    
                    <p style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:var(--space-md)">
                        Active Project: <strong style="color:var(--text-heading)">${settings.name || 'Default Project'}</strong> (ID: ${projectId})
                    </p>

                    <div style="display:flex;gap:var(--space-md)">
                        <input type="text" readonly value="${projectDsn}" class="global-search" style="width:100%;height:38px;font-family:var(--font-mono);padding:0 12px" id="wizard-dsn-field">
                        <button class="btn btn-primary" id="btn-copy-dsn-wizard" style="height:38px;white-space:nowrap">Copy DSN Key</button>
                    </div>
                </div>

                <!-- STEP 2: Ingestion Code Snippets Panel -->
                <div class="panel" style="margin-bottom:var(--space-xl);padding:var(--space-xl)">
                    <div style="margin-bottom:var(--space-md)">
                        <span class="severity-badge open" style="background:var(--accent-surface);color:var(--accent-content);margin-bottom:4px;display:inline-block">Step 2 of 3</span>
                        <h3 class="section-title" style="margin:0">Configure Telemetry Collector</h3>
                    </div>

                    <div style="display:flex;gap:var(--space-md);border-bottom:1px solid var(--border-primary);padding-bottom:var(--space-md);margin-bottom:var(--space-lg)">
                        <button class="filter-pill active" id="tab-curl">cURL 1-Click Test</button>
                        <button class="filter-pill" id="tab-helm">Helm Chart (Kubernetes)</button>
                        <button class="filter-pill" id="tab-python">Python SDK</button>
                    </div>

                    <!-- cURL Tab -->
                    <div id="content-curl">
                        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                            Send an instant HTTP telemetry flush payload to your project DSN:
                        </p>
                        <div class="code-block" style="background:var(--bg-primary);padding:var(--space-lg);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--text-xs);position:relative;border:1px solid var(--border-primary);white-space:pre-wrap;word-break:break-all">
                            <button class="btn btn-ghost btn-copy-code" data-code="${encodeURIComponent(curlSnippet)}" style="position:absolute;top:10px;right:10px;height:28px">Copy cURL</button>
                            <code>${curlSnippet}</code>
                        </div>
                    </div>

                    <!-- Helm Tab -->
                    <div id="content-helm" style="display:none">
                        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                            Deploy the lightweight eBPF collector DaemonSet on your Kubernetes cluster:
                        </p>
                        <div class="code-block" style="background:var(--bg-primary);padding:var(--space-lg);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--text-xs);position:relative;border:1px solid var(--border-primary);white-space:pre-wrap;word-break:break-all">
                            <button class="btn btn-ghost btn-copy-code" data-code="${encodeURIComponent(helmSnippet)}" style="position:absolute;top:10px;right:10px;height:28px">Copy Command</button>
                            <code>${helmSnippet}</code>
                        </div>
                    </div>

                    <!-- Python SDK Tab -->
                    <div id="content-python" style="display:none">
                        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                            Instrument Python application workloads or serverless functions:
                        </p>
                        <div class="code-block" style="background:var(--bg-primary);padding:var(--space-lg);border-radius:var(--radius-md);font-family:var(--font-mono);font-size:var(--text-xs);position:relative;border:1px solid var(--border-primary);white-space:pre-wrap">
                            <button class="btn btn-ghost btn-copy-code" data-code="${encodeURIComponent(pythonSnippet)}" style="position:absolute;top:10px;right:10px;height:28px">Copy Code</button>
                            <code>${pythonSnippet}</code>
                        </div>
                    </div>
                </div>

                <!-- STEP 3: Live Verification & Connection Tester -->
                <div class="panel" style="padding:var(--space-xl)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md)">
                        <div>
                            <span class="severity-badge open" style="background:var(--accent-surface);color:var(--accent-content);margin-bottom:4px;display:inline-block">Step 3 of 3</span>
                            <h3 class="section-title" style="margin:0">Live Telemetry Handshake & Test Tool</h3>
                        </div>
                        <button class="btn btn-success" id="btn-send-test-flush" style="height:36px">
                            🚀 Send Test Telemetry Batch
                        </button>
                    </div>

                    <div id="test-flush-output" style="margin-bottom:var(--space-md)"></div>

                    <div style="display:flex;align-items:center;gap:var(--space-md);background:var(--bg-primary);padding:var(--space-lg);border-radius:var(--radius-md);border:1px solid var(--border-primary)">
                        <span style="color:var(--success-content);font-size:18px" class="pulse-dot">●</span>
                        <div>
                            <strong style="color:var(--text-heading)">Telemetry Endpoint Ready</strong>
                            <p style="font-size:var(--text-xs);color:var(--text-secondary)">
                                DSN URL: <code style="color:var(--accent-content);font-family:var(--font-mono)">${projectDsn}</code>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Tab switching logic
        const curlTab = container.querySelector('#tab-curl');
        const helmTab = container.querySelector('#tab-helm');
        const pythonTab = container.querySelector('#tab-python');
        const curlContent = container.querySelector('#content-curl');
        const helmContent = container.querySelector('#content-helm');
        const pythonContent = container.querySelector('#content-python');

        curlTab?.addEventListener('click', () => {
            curlTab.classList.add('active'); helmTab.classList.remove('active'); pythonTab.classList.remove('active');
            curlContent.style.display = 'block'; helmContent.style.display = 'none'; pythonContent.style.display = 'none';
        });
        helmTab?.addEventListener('click', () => {
            helmTab.classList.add('active'); curlTab.classList.remove('active'); pythonTab.classList.remove('active');
            helmContent.style.display = 'block'; curlContent.style.display = 'none'; pythonContent.style.display = 'none';
        });
        pythonTab?.addEventListener('click', () => {
            pythonTab.classList.add('active'); curlTab.classList.remove('active'); helmTab.classList.remove('active');
            pythonContent.style.display = 'block'; curlContent.style.display = 'none'; helmContent.style.display = 'none';
        });

        // Copy buttons
        container.querySelector('#btn-copy-dsn-wizard')?.addEventListener('click', () => {
            navigator.clipboard.writeText(projectDsn);
            const btn = container.querySelector('#btn-copy-dsn-wizard');
            btn.innerText = 'Copied!';
            setTimeout(() => { btn.innerText = 'Copy DSN Key'; }, 2000);
        });

        container.querySelectorAll('.btn-copy-code').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = decodeURIComponent(btn.dataset.code);
                navigator.clipboard.writeText(code);
                const originalText = btn.innerText;
                btn.innerText = 'Copied!';
                setTimeout(() => { btn.innerText = originalText; }, 2000);
            });
        });

        // Regenerate DSN Key button
        container.querySelector('#btn-regen-dsn-wizard')?.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to regenerate the Project DSN Key? Existing agents using the old key will need to be updated.')) return;
            try {
                await api.regenerateProjectDSN(projectId);
                renderWizard();
            } catch (err) {
                alert(`Failed to regenerate DSN: ${err.message}`);
            }
        });

        // Send Test Telemetry Batch button
        container.querySelector('#btn-send-test-flush')?.addEventListener('click', async () => {
            const btn = container.querySelector('#btn-send-test-flush');
            const output = container.querySelector('#test-flush-output');
            btn.disabled = true;
            btn.innerText = '⌛ Transmitting...';
            output.innerHTML = `<span style="color:var(--text-secondary);font-size:var(--text-xs)">Posting workload telemetry snapshot to DSN...</span>`;

            try {
                const res = await fetch(`/api/collector/v1/ingest/${projectId}/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Project-Key': projectApiKey
                    },
                    body: JSON.stringify({
                        workloads: [
                            {
                                namespace: "production",
                                controller_name: "kafka-connect",
                                network_cost_total: 142.80,
                                network_egress_bytes: 182749102948,
                                cross_zone_cost: 28.50,
                                internet_cost: 114.30
                            },
                            {
                                namespace: "media",
                                controller_name: "image-processor",
                                network_cost_total: 18.20,
                                network_egress_bytes: 21474836480,
                                cross_zone_cost: 4.10,
                                internet_cost: 14.10
                            }
                        ]
                    })
                });

                const data = await res.json();
                if (res.ok) {
                    output.innerHTML = `
                        <div style="background:var(--accent-surface);border:1px solid var(--accent);padding:12px;border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--text-primary)">
                            <strong style="color:var(--success-content)">✓ Telemetry Handshake Successful!</strong><br>
                            Ingested <strong>${data.workloads_ingested || 2}</strong> workloads (Snapshot ID #${data.snapshot_id || 'new'}). Telemetry metrics are now live in your Overview & Traffic dashboard!
                        </div>
                    `;
                    btn.innerText = '✓ Test Telemetry Sent!';
                    setTimeout(() => { btn.innerText = '🚀 Send Test Telemetry Batch'; btn.disabled = false; }, 3000);
                } else {
                    throw new Error(data.detail || data.error || 'Ingestion failed');
                }
            } catch (err) {
                output.innerHTML = `<div style="color:var(--critical-content);font-size:var(--text-xs)">❌ Connection Error: ${err.message}</div>`;
                btn.innerText = '🚀 Send Test Telemetry Batch';
                btn.disabled = false;
            }
        });
    }

    await renderWizard();
}
