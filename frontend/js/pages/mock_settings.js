export function renderMockSettings(container) {
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
                    <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-bottom:var(--space-md)">
                        Use your Project DSN to authenticate collector agents, Prometheus scrapers, or custom eBPF telemetry pipelines.
                    </p>
                    
                    <div style="display:flex;gap:var(--space-md);align-items:center;margin-bottom:var(--space-lg)">
                        <input type="text" readonly value="http://sd_live_9f8a37b120c94e82b7@localhost:8000/api/collector/v1/ingest/1" 
                            style="flex:1;background:var(--bg-app);border:1px solid var(--border-primary);padding:8px var(--space-md);border-radius:var(--radius-md);color:var(--accent-content);font-family:var(--font-mono);font-size:var(--text-xs)" />
                        <button class="btn btn-primary" onclick="navigator.clipboard.writeText('http://sd_live_9f8a37b120c94e82b7@localhost:8000/api/collector/v1/ingest/1');alert('DSN Copied to Clipboard!')">
                            Copy DSN
                        </button>
                    </div>

                    <div style="font-size:var(--text-xs);color:var(--text-disabled);display:flex;gap:var(--space-xl)">
                        <span><strong>Project ID:</strong> 1</span>
                        <span><strong>Environment:</strong> production</span>
                        <span><strong>API Secret:</strong> sd_sec_****************4f8a</span>
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
                            <span>Warning Threshold (+200% Increase)</span>
                            <span style="color:var(--warning-content)">+200%</span>
                        </div>
                        <input type="range" min="50" max="500" value="200" style="width:100%;accent-color:var(--warning)" />
                    </div>

                    <div style="margin-top:var(--space-lg)">
                        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-xs);font-size:var(--text-xs);color:var(--text-secondary)">
                            <span>Critical Threshold (+500% Increase)</span>
                            <span style="color:var(--critical-content)">+500%</span>
                        </div>
                        <input type="range" min="100" max="1000" value="500" style="width:100%;accent-color:var(--critical)" />
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
                        <input type="text" value="http://opencost.monitoring.svc:9003" 
                            style="width:100%;background:var(--bg-app);border:1px solid var(--border-primary);padding:8px var(--space-md);border-radius:var(--radius-md);color:var(--text-primary);font-size:var(--text-xs)" />
                    </div>
                    <button class="btn btn-ghost" onclick="alert('Connection test successful! OpenCost API reachable.')">
                        Test OpenCost Connection
                    </button>
                </div>
            </div>
        </div>
    `;
}
