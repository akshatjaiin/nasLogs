export function renderMockSettings(container) {
    let warningVal = 200;
    let criticalVal = 500;

    function render() {
        container.innerHTML = `
            <div class="page">
                <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
                    <div>
                        <h1 class="page-title">Project Settings & Ingestion DSN</h1>
                        <p class="page-subtitle">Configure agent DSN keys, anomaly detection parameters, and cluster connections</p>
                    </div>
                    <span class="severity-badge warning" style="font-size:var(--text-xs)">🚧 MOCK — Under Active Development</span>
                </div>

                <!-- DSN INGESTION KEY (SENTRY STYLE) -->
                <div class="panel" style="margin-bottom:var(--space-xl)">
                    <div class="panel-header">
                        <h3 class="panel-title">🔑 Client Keys (DSN)</h3>
                    </div>
                    <div class="panel-body">
                        <p style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:var(--space-md)">
                            Use your Project DSN to authenticate collector agents, Prometheus scrapers, or custom eBPF telemetry pipelines.
                        </p>
                        
                        <div style="display:flex;gap:var(--space-md);align-items:center;margin-bottom:var(--space-md)">
                            <input type="text" readonly id="dsn-input" value="http://sd_live_9f8a37b120c94e82b7@localhost:8000/api/collector/v1/ingest/1" 
                                style="flex:1;background:var(--bg-app);border:1px solid var(--border-primary);padding:8px var(--space-md);border-radius:var(--radius-md);color:var(--accent-content);font-family:var(--font-mono);font-size:var(--text-xs)" />
                            <button class="btn btn-primary" id="btn-copy-dsn">
                                Copy DSN
                            </button>
                        </div>

                        <div style="font-size:var(--text-xs);color:var(--text-disabled);display:flex;gap:var(--space-xl)">
                            <span><strong>Project ID:</strong> 1</span>
                            <span><strong>Environment:</strong> production</span>
                            <span><strong>API Key Status:</strong> <span style="color:var(--success-content)">Active</span></span>
                        </div>
                    </div>
                </div>

                <!-- ANOMALY DETECTOR CONFIG -->
                <div class="panel" style="margin-bottom:var(--space-xl)">
                    <div class="panel-header">
                        <h3 class="panel-title">⚡ Anomaly Detector Configuration</h3>
                    </div>
                    <div class="panel-body">
                        <div class="grid-2">
                            <div>
                                <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-secondary);margin-bottom:var(--space-xs)">
                                    Detection Algorithm
                                </label>
                                <select class="time-select" style="width:100%">
                                    <option selected>Percentage Change (Δ% vs Baseline)</option>
                                    <option>Z-Score Statistical Deviation (σ)</option>
                                </select>
                            </div>
                            <div>
                                <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-secondary);margin-bottom:var(--space-xs)">
                                    Baseline Window
                                </label>
                                <select class="time-select" style="width:100%">
                                    <option selected>7 Days (168 Hours)</option>
                                    <option>14 Days (336 Hours)</option>
                                    <option>30 Days (720 Hours)</option>
                                </select>
                            </div>
                        </div>

                        <div style="margin-top:var(--space-lg)">
                            <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-xs);font-size:var(--text-xs);color:var(--text-secondary)">
                                <span>Warning Threshold (+${warningVal}% Increase)</span>
                                <span style="color:var(--warning-content);font-weight:700">+${warningVal}%</span>
                            </div>
                            <input type="range" id="warning-slider" min="50" max="500" value="${warningVal}" style="width:100%;accent-color:var(--warning)" />
                        </div>

                        <div style="margin-top:var(--space-lg)">
                            <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-xs);font-size:var(--text-xs);color:var(--text-secondary)">
                                <span>Critical Threshold (+${criticalVal}% Increase)</span>
                                <span style="color:var(--critical-content);font-weight:700">+${criticalVal}%</span>
                            </div>
                            <input type="range" id="critical-slider" min="100" max="1000" value="${criticalVal}" style="width:100%;accent-color:var(--critical)" />
                        </div>

                        <div style="margin-top:var(--space-xl);display:flex;justify-content:flex-end">
                            <button class="btn btn-primary" id="btn-save-settings">Save Threshold Settings</button>
                        </div>
                    </div>
                </div>

                <!-- OPENVAS / OPENCOST BACKEND CONNECTION -->
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">🔌 Cluster Collector Integration</h3>
                    </div>
                    <div class="panel-body">
                        <div style="margin-bottom:var(--space-md)">
                            <label style="display:block;font-size:var(--text-xs);font-weight:600;color:var(--text-secondary);margin-bottom:var(--space-xs)">
                                OpenCost API Endpoint
                            </label>
                            <input type="text" id="opencost-url-input" value="http://opencost.monitoring.svc:9003" 
                                style="width:100%;background:var(--bg-app);border:1px solid var(--border-primary);padding:8px var(--space-md);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-xs)" />
                        </div>
                        <button class="btn btn-ghost" id="btn-test-conn">
                            Test OpenCost Connection
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Bind copy button
        container.querySelector('#btn-copy-dsn').addEventListener('click', () => {
            const dsn = container.querySelector('#dsn-input').value;
            navigator.clipboard.writeText(dsn);
            const btn = container.querySelector('#btn-copy-dsn');
            btn.textContent = '✓ DSN Copied!';
            setTimeout(() => { btn.textContent = 'Copy DSN'; }, 2000);
        });

        // Sliders
        container.querySelector('#warning-slider').addEventListener('input', (e) => {
            warningVal = e.target.value;
            container.querySelector('#warning-slider').previousElementSibling.querySelector('span:last-child').textContent = `+${warningVal}%`;
        });

        container.querySelector('#critical-slider').addEventListener('input', (e) => {
            criticalVal = e.target.value;
            container.querySelector('#critical-slider').previousElementSibling.querySelector('span:last-child').textContent = `+${criticalVal}%`;
        });

        container.querySelector('#btn-save-settings').addEventListener('click', () => {
            const btn = container.querySelector('#btn-save-settings');
            btn.textContent = '✓ Settings Saved';
            setTimeout(() => { btn.textContent = 'Save Threshold Settings'; }, 2000);
        });

        container.querySelector('#btn-test-conn').addEventListener('click', () => {
            const btn = container.querySelector('#btn-test-conn');
            btn.textContent = '⏳ Testing Connection...';
            setTimeout(() => {
                btn.textContent = '✓ Connection Successful (200 OK)';
                btn.style.color = 'var(--success-content)';
                setTimeout(() => {
                    btn.textContent = 'Test OpenCost Connection';
                    btn.style.color = '';
                }, 3000);
            }, 800);
        });
    }

    render();
}
