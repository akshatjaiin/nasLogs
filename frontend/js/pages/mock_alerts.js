export function renderMockAlerts(container) {
    let alertRules = [
        { id: 1, name: 'Slack Ops Cost Alerts', channel: 'Slack Webhook', target: '#ops-network-costs', filter: 'Critical (+500%)', status: 'Active', severityClass: 'critical' },
        { id: 2, name: 'DevOps Team Email Digest', channel: 'Email', target: 'devops-alerts@acme.com', filter: 'Warning & Critical', status: 'Active', severityClass: 'warning' },
        { id: 3, name: 'PagerDuty On-Call Escalate', channel: 'PagerDuty', target: 'service_key_pd_8892', filter: 'Critical Only', status: 'Disabled', severityClass: 'disabled' },
    ];

    function render() {
        const activeRules = alertRules.filter(r => r.status === 'Active').length;

        container.innerHTML = `
            <div class="page">
                <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
                    <div>
                        <h1 class="page-title">Alert Rules & Integrations</h1>
                        <p class="page-subtitle">Configure real-time webhooks & notifications when cost spikes match severity thresholds</p>
                    </div>
                    <span class="severity-badge warning" style="font-size:var(--text-xs)">🚧 MOCK — Under Active Development</span>
                </div>

                <div class="toolbar">
                    <div class="toolbar-left">
                        <span style="font-size:var(--text-xs);color:var(--text-secondary)">
                            Active Alert Targets: <strong style="color:var(--text-heading)">${activeRules} Configured</strong>
                        </span>
                    </div>
                    <div class="toolbar-right">
                        <button class="btn btn-primary" id="btn-create-alert">+ Create Alert Rule</button>
                    </div>
                </div>

                <div class="panel" style="margin-bottom:var(--space-xl)">
                    <table class="correlations-table">
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Rule Name</th>
                                <th>Channel Type</th>
                                <th>Target Endpoint</th>
                                <th>Severity Filter</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${alertRules.map(rule => `
                                <tr style="${rule.status === 'Disabled' ? 'opacity:0.5' : ''}">
                                    <td><span class="severity-badge ${rule.status === 'Active' ? 'resolved' : 'open'}">${rule.status}</span></td>
                                    <td style="font-weight:600;color:var(--text-heading)">${rule.name}</td>
                                    <td><span class="severity-badge" style="background:var(--accent-surface);color:var(--accent-content)">${rule.channel}</span></td>
                                    <td style="font-family:var(--font-mono);font-size:var(--text-xs)">${rule.target}</td>
                                    <td><span class="severity-badge ${rule.severityClass}">${rule.filter}</span></td>
                                    <td>
                                        <button class="btn btn-ghost btn-toggle-rule" data-id="${rule.id}" style="height:26px;padding:0 8px">
                                            ${rule.status === 'Active' ? 'Disable' : 'Enable'}
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- SLACK PAYLOAD PREVIEW -->
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">💬 Live Slack Message Payload Preview</h3>
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
                            <div style="border-left:3px solid #FF3B30;padding-left:10px;margin-bottom:8px;font-size:12px;color:#D1D2D3">
                                <strong>Likely Cause (92% Confidence):</strong> Deployment <code>cart-service v2.1</code> updated 5 minutes before spike.
                            </div>
                            <a href="/incidents/1" data-link style="color:#1D9BD1;font-size:12px;font-weight:600">View Blame Trail in Smoke Detector →</a>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL DIALOG FOR CREATING ALERT RULE -->
            <div id="alert-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center">
                <div style="background:var(--bg-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-xl);width:480px;max-width:90vw">
                    <h3 style="font-size:var(--text-lg);font-weight:700;color:var(--text-heading);margin-bottom:var(--space-sm)">Create Alert Rule</h3>
                    <p style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:var(--space-lg)">Configure webhook target for cost spike anomalies</p>
                    
                    <div style="margin-bottom:var(--space-md)">
                        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-secondary);margin-bottom:4px">Rule Name</label>
                        <input type="text" id="alert-name-input" placeholder="e.g. Discord Egress Alert" style="width:100%;background:var(--bg-app);border:1px solid var(--border-primary);padding:8px var(--space-md);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-xs)" />
                    </div>

                    <div style="margin-bottom:var(--space-md)">
                        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-secondary);margin-bottom:4px">Channel Type</label>
                        <select id="alert-channel-select" class="time-select" style="width:100%">
                            <option value="Slack Webhook">Slack Webhook</option>
                            <option value="Email">Email</option>
                            <option value="PagerDuty">PagerDuty</option>
                            <option value="Discord">Discord Webhook</option>
                        </select>
                    </div>

                    <div style="margin-bottom:var(--space-lg)">
                        <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-secondary);margin-bottom:4px">Target Endpoint / Webhook URL</label>
                        <input type="text" id="alert-target-input" placeholder="https://hooks.slack.com/services/..." style="width:100%;background:var(--bg-app);border:1px solid var(--border-primary);padding:8px var(--space-md);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-xs)" />
                    </div>

                    <div style="display:flex;justify-content:flex-end;gap:var(--space-md)">
                        <button class="btn btn-ghost" id="btn-modal-cancel">Cancel</button>
                        <button class="btn btn-primary" id="btn-modal-save">Save Rule</button>
                    </div>
                </div>
            </div>
        `;

        // Bind events
        const modal = container.querySelector('#alert-modal');
        container.querySelector('#btn-create-alert').addEventListener('click', () => {
            modal.style.display = 'flex';
        });
        container.querySelector('#btn-modal-cancel').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        container.querySelector('#btn-modal-save').addEventListener('click', () => {
            const name = container.querySelector('#alert-name-input').value || 'New Alert Rule';
            const channel = container.querySelector('#alert-channel-select').value;
            const target = container.querySelector('#alert-target-input').value || '#alerts';
            
            alertRules.push({
                id: Date.now(),
                name,
                channel,
                target,
                filter: 'Critical (+500%)',
                status: 'Active',
                severityClass: 'critical'
            });
            modal.style.display = 'none';
            render();
        });

        // Toggle enable/disable
        container.querySelectorAll('.btn-toggle-rule').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.id);
                const rule = alertRules.find(r => r.id === id);
                if (rule) {
                    rule.status = rule.status === 'Active' ? 'Disabled' : 'Active';
                    render();
                }
            });
        });
    }

    render();
}
