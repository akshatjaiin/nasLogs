export function renderMockAlerts(container) {
    container.innerHTML = `
        <div class="page">
            <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
                <div>
                    <h1 class="page-title">Alert Rules & Integrations</h1>
                    <p class="page-subtitle">Configure notifications when cost spikes match severity thresholds</p>
                </div>
                <span class="severity-badge warning" style="font-size:var(--text-xs)">🚧 MOCK — Under Active Development</span>
            </div>

            <div class="toolbar">
                <div class="toolbar-left">
                    <span style="font-size:var(--text-xs);color:var(--text-secondary)">Active Alert Targets: <strong style="color:var(--text-heading)">2 Configured</strong></span>
                </div>
                <div class="toolbar-right">
                    <button class="btn btn-primary" onclick="alert('Create Alert Rule modal opens here.')">+ Create Alert Rule</button>
                </div>
            </div>

            <div class="panel" style="margin-bottom:var(--space-xl)">
                <table class="correlations-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Rule Name</th>
                            <th>Channel</th>
                            <th>Target / Endpoint</th>
                            <th>Filter</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><span class="severity-badge resolved">Active</span></td>
                            <td style="font-weight:600;color:var(--text-heading)">Slack Ops Cost Alerts</td>
                            <td><span class="severity-badge open">Slack Webhook</span></td>
                            <td style="font-family:var(--font-mono)">#ops-network-costs</td>
                            <td><span class="severity-badge critical">Critical (+500%)</span></td>
                            <td><button class="btn btn-ghost" style="height:24px;padding:0 8px">Edit</button></td>
                        </tr>
                        <tr>
                            <td><span class="severity-badge resolved">Active</span></td>
                            <td style="font-weight:600;color:var(--text-heading)">DevOps Team Email Digest</td>
                            <td><span class="severity-badge acknowledged">Email</span></td>
                            <td style="font-family:var(--font-mono)">devops-alerts@acme.com</td>
                            <td><span class="severity-badge warning">Warning & Critical</span></td>
                            <td><button class="btn btn-ghost" style="height:24px;padding:0 8px">Edit</button></td>
                        </tr>
                        <tr style="opacity:0.6">
                            <td><span class="severity-badge" style="background:var(--bg-tertiary);color:var(--text-disabled)">Disabled</span></td>
                            <td style="font-weight:600;color:var(--text-heading)">PagerDuty On-Call Escalate</td>
                            <td><span class="severity-badge" style="background:var(--accent-surface);color:var(--accent-content)">PagerDuty</span></td>
                            <td style="font-family:var(--font-mono)">service_key_pd_8892</td>
                            <td><span class="severity-badge critical">Critical Only</span></td>
                            <td><button class="btn btn-ghost" style="height:24px;padding:0 8px">Enable</button></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- SLACK PAYLOAD PREVIEW -->
            <div class="panel">
                <div class="panel-header">
                    <h3 class="panel-title">💬 Slack Message Payload Preview</h3>
                </div>
                <div class="panel-body">
                    <div style="background:#1A1D21;border:1px solid #2C3136;border-radius:8px;padding:var(--space-md);font-family:var(--font-body)">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                            <span style="font-size:16px">🚨</span>
                            <strong style="color:#ECEDEE;font-size:14px">CRITICAL: Network Cost Spike Detected</strong>
                        </div>
                        <p style="color:#ABABAD;font-size:13px;margin-bottom:8px">
                            Workload <code>ecommerce/cart-service</code> network cost spiked by <strong>+600%</strong> ($1.20/hr → $8.40/hr).
                        </p>
                        <div style="border-left:3px solid #FF002B;padding-left:10px;margin-bottom:8px;font-size:12px;color:#D1D2D3">
                            <strong>Likely Cause (92% Confidence):</strong> Deployment <code>cart-service v2.1</code> updated 5 minutes before spike.
                        </div>
                        <a href="http://localhost:3000/incidents/1" style="color:#1D9BD1;font-size:12px;font-weight:600">View Blame Trail in Smoke Detector →</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}
