import { api } from '../api.js';

export async function renderSettings(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:500px;margin:24px"></div></div>`;

    async function render() {
        try {
            const settings = await api.getProjectSettings(window.currentProjectId || '1');
            const projectsData = await api.getProjects().catch(() => ({ projects: [] }));
            const projects = projectsData.projects || [];

            container.innerHTML = `
                <div class="page">
                    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center">
                        <div>
                            <h1 class="page-title">Project Settings & Telemetry Retention</h1>
                            <p class="page-subtitle">Configure OpenCost endpoints, DSN keys, anomaly detection sensitivity, and data retention rules</p>
                        </div>
                        <button class="btn btn-primary" id="btn-add-project">
                            + Add Cluster Project
                        </button>
                    </div>

                    <!-- Multi-Project Switcher Panel -->
                    <div class="panel" style="margin-bottom:var(--space-xl)">
                        <h3 class="section-title">Cluster Projects (${projects.length})</h3>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:var(--space-md);margin-top:var(--space-md)">
                            ${projects.map(p => `
                                <div class="panel" style="background:var(--bg-secondary);border:1px solid ${p.id == (window.currentProjectId || '1') ? 'var(--accent)' : 'var(--border-primary)'};padding:var(--space-md);border-radius:var(--radius-md)">
                                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                                        <strong style="color:var(--text-heading);font-size:var(--text-md)">${p.name}</strong>
                                        ${p.id == (window.currentProjectId || '1') ? '<span class="severity-badge open" style="background:var(--accent-surface);color:var(--accent-content)">Active</span>' : ''}
                                    </div>
                                    <div style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:8px">
                                        ${p.opencost_url}
                                    </div>
                                    <button class="btn btn-ghost btn-switch-project" data-id="${p.id}" style="width:100%;height:28px;font-size:var(--text-xs)">
                                        ${p.id == (window.currentProjectId || '1') ? 'Selected' : 'Switch Project'}
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- OpenCost Collector Connection -->
                    <div class="panel" style="margin-bottom:var(--space-xl)">
                        <h3 class="section-title">Cluster Collector Integration</h3>
                        <div style="display:grid;gap:var(--space-lg);margin-top:var(--space-md)">
                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:6px">OpenCost API Endpoint</label>
                                <div style="display:flex;gap:var(--space-md)">
                                    <input type="text" id="opencost-url-input" value="${settings.opencost_url || 'http://opencost.monitoring.svc:9003'}" class="global-search" style="width:100%;height:38px;padding:0 12px">
                                    <button class="btn btn-ghost" id="btn-test-connection" style="white-space:nowrap;height:38px">
                                        Test Connection
                                    </button>
                                </div>
                                <div id="connection-status-output" style="margin-top:8px;font-size:var(--text-xs)"></div>
                            </div>
                        </div>
                    </div>

                    <!-- DSN Key Card -->
                    <div class="panel" style="margin-bottom:var(--space-xl)">
                        <h3 class="section-title">Telemetry Ingestion DSN</h3>
                        <p style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:var(--space-md)">
                            Use this Project DSN key in your Kubernetes DaemonSet or Python SDK to authenticate data collection.
                        </p>
                        <div style="display:flex;gap:var(--space-md)">
                            <input type="text" readonly value="${settings.dsn}" class="global-search" style="width:100%;height:38px;font-family:var(--font-mono);padding:0 12px" id="dsn-input-field">
                            <button class="btn btn-primary" id="btn-copy-dsn-key" style="height:38px">Copy DSN</button>
                        </div>
                    </div>

                    <!-- Retention & Anomaly Controls -->
                    <div class="panel">
                        <h3 class="section-title">Data Retention & Anomaly Engine Controls</h3>
                        
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-xl);margin-top:var(--space-md)">
                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:6px">Telemetry Data Retention Policy</label>
                                <select id="retention-days-select" class="project-dropdown" style="width:100%;height:38px">
                                    <option value="7" ${settings.retention_days === 7 ? 'selected' : ''}>7 Days Retention</option>
                                    <option value="30" ${settings.retention_days === 30 || !settings.retention_days ? 'selected' : ''}>30 Days Retention (Default)</option>
                                    <option value="90" ${settings.retention_days === 90 ? 'selected' : ''}>90 Days Retention (Quarterly)</option>
                                    <option value="180" ${settings.retention_days === 180 ? 'selected' : ''}>180 Days Retention</option>
                                </select>
                            </div>

                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:6px">Baseline History Window</label>
                                <select id="baseline-window-select" class="project-dropdown" style="width:100%;height:38px">
                                    <option value="24" ${settings.baseline_window_hours === 24 ? 'selected' : ''}>24 Hours Window</option>
                                    <option value="168" ${settings.baseline_window_hours === 168 || !settings.baseline_window_hours ? 'selected' : ''}>7 Days Window (Default)</option>
                                    <option value="336" ${settings.baseline_window_hours === 336 ? 'selected' : ''}>14 Days Window</option>
                                    <option value="720" ${settings.baseline_window_hours === 720 ? 'selected' : ''}>30 Days Window</option>
                                </select>
                            </div>

                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:6px">Warning Threshold (% spike over baseline)</label>
                                <input type="number" id="warning-pct-input" value="${settings.warning_pct || 200}" class="global-search" style="width:100%;height:38px;padding:0 12px">
                            </div>

                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:6px">Critical Threshold (% spike over baseline)</label>
                                <input type="number" id="critical-pct-input" value="${settings.critical_pct || 500}" class="global-search" style="width:100%;height:38px;padding:0 12px">
                            </div>

                            <div style="grid-column: span 2">
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:6px">Noise Floor Threshold ($/hr minimum cost to trigger)</label>
                                <input type="number" step="0.001" id="min-cost-input" value="${settings.min_cost_threshold || 0.010}" class="global-search" style="width:100%;height:38px;padding:0 12px">
                                <p style="font-size:var(--text-xs);color:var(--text-disabled);margin-top:4px">Ignore minor fluctuations under this cost noise floor</p>
                            </div>
                        </div>

                        <div style="margin-top:var(--space-xl);display:flex;justify-content:flex-end">
                            <button class="btn btn-success" id="btn-save-settings">Save Settings</button>
                        </div>
                    </div>
                </div>

                <!-- Add Project Modal -->
                <div id="modal-add-project" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:999;align-items:center;justify-content:center">
                    <div class="panel" style="width:480px;background:var(--bg-primary);border:1px solid var(--border-primary)">
                        <h3 class="section-title" style="margin-bottom:var(--space-lg)">Create New Cluster Project</h3>
                        <div style="display:grid;gap:var(--space-md)">
                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">Project Name</label>
                                <input type="text" id="new-project-name" placeholder="e.g. Staging Cluster (GCP)" class="global-search" style="width:100%;height:36px;padding:0 10px">
                            </div>
                            <div>
                                <label style="display:block;font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:4px">OpenCost URL</label>
                                <input type="text" id="new-project-url" value="http://opencost.monitoring.svc:9003" class="global-search" style="width:100%;height:36px;padding:0 10px">
                            </div>
                        </div>
                        <div style="display:flex;justify-content:flex-end;gap:var(--space-md);margin-top:var(--space-xl)">
                            <button class="btn btn-ghost" id="btn-cancel-project-modal">Cancel</button>
                            <button class="btn btn-primary" id="btn-submit-project-modal">Create Project</button>
                        </div>
                    </div>
                </div>
            `;

            // Switch project handlers
            container.querySelectorAll('.btn-switch-project').forEach(btn => {
                btn.addEventListener('click', () => {
                    window.currentProjectId = btn.dataset.id;
                    render();
                });
            });

            // Open & close add project modal
            const projModal = document.getElementById('modal-add-project');
            document.getElementById('btn-add-project')?.addEventListener('click', () => { projModal.style.display = 'flex'; });
            document.getElementById('btn-cancel-project-modal')?.addEventListener('click', () => { projModal.style.display = 'none'; });

            document.getElementById('btn-submit-project-modal')?.addEventListener('click', async () => {
                const name = document.getElementById('new-project-name').value;
                const opencost_url = document.getElementById('new-project-url').value;
                if (!name) return alert('Please enter a project name');

                try {
                    const res = await api.createProject({ name, opencost_url });
                    window.currentProjectId = res.project.id;
                    projModal.style.display = 'none';
                    render();
                } catch (err) {
                    alert(`Failed to create project: ${err.message}`);
                }
            });

            // Test OpenCost connection
            const testBtn = document.getElementById('btn-test-connection');
            const statusOutput = document.getElementById('connection-status-output');
            const urlInput = document.getElementById('opencost-url-input');

            testBtn?.addEventListener('click', async () => {
                testBtn.disabled = true;
                testBtn.innerHTML = `⌛ Testing...`;
                statusOutput.innerHTML = ``;
                try {
                    const res = await api.testOpenCostConnection(urlInput.value);
                    if (res.status === 'connected') {
                        statusOutput.innerHTML = `<span style="color:var(--success-content)"> ${res.message}</span>`;
                        testBtn.innerHTML = ` Connection Tested`;
                    } else {
                        statusOutput.innerHTML = `<span style="color:var(--critical-content)"> ${res.message}</span>`;
                        testBtn.innerHTML = ` Connection Failed`;
                    }
                } catch (err) {
                    statusOutput.innerHTML = `<span style="color:var(--critical-content)"> ${err.message}</span>`;
                    testBtn.innerHTML = `Test Connection`;
                }
                testBtn.disabled = false;
            });

            // Copy DSN handler
            document.getElementById('btn-copy-dsn-key')?.addEventListener('click', () => {
                navigator.clipboard.writeText(settings.dsn);
                const btn = document.getElementById('btn-copy-dsn-key');
                btn.innerText = 'Copied!';
                setTimeout(() => { btn.innerText = 'Copy DSN'; }, 2000);
            });

            // Save Settings handler
            document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
                const saveBtn = document.getElementById('btn-save-settings');
                saveBtn.disabled = true;
                saveBtn.innerText = 'Saving...';
                try {
                    await api.updateProjectSettings({
                        project_id: window.currentProjectId || '1',
                        opencost_url: urlInput.value,
                        retention_days: document.getElementById('retention-days-select').value,
                        baseline_window_hours: document.getElementById('baseline-window-select').value,
                        warning_pct: document.getElementById('warning-pct-input').value,
                        critical_pct: document.getElementById('critical-pct-input').value,
                        min_cost_threshold: document.getElementById('min-cost-input').value,
                    });
                    saveBtn.innerText = ' Settings Saved!';
                    setTimeout(() => { saveBtn.innerText = 'Save Settings'; saveBtn.disabled = false; }, 2000);
                } catch (err) {
                    alert(`Failed to save: ${err.message}`);
                    saveBtn.disabled = false;
                    saveBtn.innerText = 'Save Settings';
                }
            });

        } catch (err) {
            container.innerHTML = `<div class="page"><div class="empty-state"><h3>Failed to load settings</h3><p>${err.message}</p></div></div>`;
        }
    }

    await render();
}
