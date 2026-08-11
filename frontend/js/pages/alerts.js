import { api } from '../api.js';

export async function renderAlerts(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:500px;margin:24px"></div></div>`;

    async function render() {
        try {
            const rules = await api.getAlertRules('1');

            container.innerHTML = `
                <div class="page">
                    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <h1 class="page-title">Alert Rules</h1>
                            <p class="page-subtitle">Configure real-time Slack webhooks and email notification targets for cost anomalies</p>
                        </div>
                        <button class="btn btn-primary" id="btn-create-rule">
                            + Create Alert Rule
                        </button>
                    </div>

                    <div class="panel">
                        <div class="table-container">
                            <table class="correlations-table">
                                <thead>
                                    <tr>
                                        <th>Rule Name</th>
                                        <th>Channel</th>
                                        <th>Config / Webhook URL</th>
                                        <th>Severity Filter</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rules.length > 0 ? rules.map(rule => `
                                        <tr>
                                            <td style="font-weight:600">${rule.name}</td>
                                            <td>
                                                <span class="severity-badge" style="background:var(--accent-surface);color:var(--accent-content)">
                                                    ${rule.channel_type === 'slack' ? 'Slack Webhook' : 'Email'}
                                                </span>
                                            </td>
                                            <td style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-secondary)">
                                                ${(rule.channel_config || {}).webhook_url || (rule.channel_config || {}).to || 'Configured'}
                                            </td>
                                            <td>
                                                <span class="severity-badge ${rule.severity_filter || 'all'}">
                                                    ${rule.severity_filter || 'All Severities'}
                                                </span>
                                            </td>
                                            <td>
                                                <span class="severity-badge ${rule.is_active ? 'resolved' : 'open'}">
                                                    ${rule.is_active ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style="display:flex;gap:8px">
                                                    <button class="btn btn-ghost btn-test-rule" data-id="${rule.id}" style="height:28px;font-size:var(--text-xs)">
                                                        Send Test
                                                    </button>
                                                    <button class="btn btn-ghost btn-delete-rule" data-id="${rule.id}" style="height:28px;font-size:var(--text-xs);color:var(--critical-content)">
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('') : `
                                        <tr>
                                            <td colspan="6" style="text-align:center;padding:var(--space-2xl);color:var(--text-secondary)">
                                                No alert rules created yet. Click <strong>+ Create Alert Rule</strong> above.
                                            </td>
                                        </tr>
                                    `}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Create Rule Modal Drawer -->
                <div id="modal-create-rule" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:999;align-items:center;justify-content:center">
                    <div class="panel" style="width:480px;background:var(--bg-primary);border:1px solid var(--border-primary)">
                        <h3 class="section-title" style="margin-bottom:var(--space-lg)">Create New Alert Rule</h3>
                        
                        <div style="display:grid;gap:var(--space-md)">
                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Rule Name</label>
                                <input type="text" id="rule-name-input" placeholder="e.g. #platform-cost-alerts" class="global-search" style="width:100%;height:36px;padding:0 10px">
                            </div>

                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Channel Type</label>
                                <select id="rule-channel-type" class="project-dropdown" style="width:100%;height:36px">
                                    <option value="slack">Slack Incoming Webhook</option>
                                    <option value="email">Email Notification</option>
                                </select>
                            </div>

                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Webhook URL / Target Email</label>
                                <input type="text" id="rule-config-input" placeholder="https://hooks.slack.com/services/..." class="global-search" style="width:100%;height:36px;padding:0 10px">
                            </div>

                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Severity Filter</label>
                                <select id="rule-severity-filter" class="project-dropdown" style="width:100%;height:36px">
                                    <option value="">All Severities (Warning + Critical)</option>
                                    <option value="critical">Critical Only (+500% spike)</option>
                                </select>
                            </div>
                        </div>

                        <div style="display:flex;justify-content:flex-end;gap:var(--space-md);margin-top:var(--space-xl)">
                            <button class="btn btn-ghost" id="btn-cancel-modal">Cancel</button>
                            <button class="btn btn-primary" id="btn-submit-modal">Create Rule</button>
                        </div>
                    </div>
                </div>
            `;

            // Test Rule Handlers
            container.querySelectorAll('.btn-test-rule').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    btn.disabled = true;
                    btn.innerText = 'Sending...';
                    try {
                        const res = await api.testAlertRule(id);
                        alert(res.message);
                    } catch (err) {
                        alert(`Test alert failed: ${err.message}`);
                    }
                    btn.disabled = false;
                    btn.innerText = 'Send Test';
                });
            });

            // Delete Rule Handlers
            container.querySelectorAll('.btn-delete-rule').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    if (confirm('Are you sure you want to delete this alert rule?')) {
                        await api.deleteAlertRule(id);
                        render();
                    }
                });
            });

            // Modal Handlers
            const modal = document.getElementById('modal-create-rule');
            document.getElementById('btn-create-rule')?.addEventListener('click', () => { modal.style.display = 'flex'; });
            document.getElementById('btn-cancel-modal')?.addEventListener('click', () => { modal.style.display = 'none'; });

            document.getElementById('btn-submit-modal')?.addEventListener('click', async () => {
                const name = document.getElementById('rule-name-input').value;
                const channel_type = document.getElementById('rule-channel-type').value;
                const configVal = document.getElementById('rule-config-input').value;
                const severity_filter = document.getElementById('rule-severity-filter').value;

                if (!name || !configVal) {
                    alert('Please enter a Rule Name and Webhook URL/Email');
                    return;
                }

                const channel_config = channel_type === 'slack' ? { webhook_url: configVal } : { to: configVal };

                try {
                    await api.createAlertRule({
                        project: 1,
                        name,
                        channel_type,
                        channel_config,
                        severity_filter,
                        is_active: true
                    });
                    modal.style.display = 'none';
                    render();
                } catch (err) {
                    alert(`Failed to create rule: ${err.message}`);
                }
            });

        } catch (err) {
            container.innerHTML = `<div class="page"><div class="empty-state"><h3>Failed to load alert rules</h3><p>${err.message}</p></div></div>`;
        }
    }

    await render();
}
