import { api } from '../api.js';
import { ChartBuilder } from '../components/ChartBuilder.js';

export async function renderBreakdown(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:600px;margin:24px"></div></div>`;
    
    try {
        const data = await api.getCostBreakdown();
        const namespaces = data.namespaces || [];
        const expanded = new Set();
        let selectedWorkload = null;
        let selectedRange = 24;

        function getDeltaClass(pct) {
            if (pct >= 200) return 'spike';
            if (pct >= 50) return 'elevated';
            if (pct < 0) return 'decrease';
            return 'normal';
        }

        function getDeltaArrow(pct) {
            if (pct > 0) return '↑';
            if (pct < 0) return '↓';
            return '—';
        }

        function render() {
            const totalCost = namespaces.reduce((sum, ns) => sum + ns.total_cost, 0);

            container.innerHTML = `
                <div class="page">
                    <div class="page-header">
                        <h1 class="page-title">Cost Breakdown</h1>
                        <p class="page-subtitle">Namespace-level network cost with drill-down to controllers</p>
                    </div>

                    <div class="toolbar">
                        <div class="toolbar-left">
                            <span style="font-size:var(--text-sm);color:var(--text-secondary)">
                                Total hourly: <strong style="color:var(--text-heading)">$${totalCost.toFixed(2)}/hr</strong>
                                · Daily: <strong style="color:var(--text-heading)">$${(totalCost * 24).toFixed(0)}/day</strong>
                            </span>
                        </div>
                    </div>

                    ${namespaces.length > 0 ? `
                        <div class="panel">
                            <div class="cost-tree-header">
                                <span>Namespace / Controller (Click controller to view history)</span>
                                <span>Cost/hr</span>
                                <span>Change</span>
                                <span></span>
                            </div>
                            <div class="cost-tree">
                                ${namespaces.map(ns => `
                                    <div class="cost-tree-row namespace" data-ns="${ns.namespace}">
                                        <span>
                                            <span class="tree-toggle ${expanded.has(ns.namespace) ? 'expanded' : ''}">▶</span>
                                            ${ns.namespace}
                                            <span style="color:var(--text-disabled);font-size:var(--text-xs)">(${(ns.controllers || []).length})</span>
                                        </span>
                                        <span style="font-variant-numeric:tabular-nums;font-weight:700">$${ns.total_cost.toFixed(2)}</span>
                                        <span class="cost-delta ${getDeltaClass(ns.delta_pct)}">${getDeltaArrow(ns.delta_pct)} ${ns.delta_pct > 0 ? '+' : ''}${ns.delta_pct}%</span>
                                        <span></span>
                                    </div>
                                    ${expanded.has(ns.namespace) ? (ns.controllers || []).map(ctrl => `
                                        <div class="cost-tree-row controller" data-ns="${ns.namespace}" data-ctrl="${ctrl.name}" data-kind="${ctrl.kind}" style="cursor:pointer">
                                            <span>└ ${ctrl.name} <span style="color:var(--text-disabled);font-size:var(--text-xs)">(${ctrl.kind})</span></span>
                                            <span style="font-variant-numeric:tabular-nums">$${ctrl.cost.toFixed(2)}</span>
                                            <span class="cost-delta ${getDeltaClass(ctrl.delta_pct)}">${getDeltaArrow(ctrl.delta_pct)} ${ctrl.delta_pct > 0 ? '+' : ''}${ctrl.delta_pct}%</span>
                                            <span style="font-size:var(--text-xs);color:var(--accent-content)">View History →</span>
                                        </div>
                                    `).join('') : ''}
                                `).join('')}
                            </div>
                        </div>
                    ` : '<div class="empty-state"><h3>No cost data yet</h3><p>Run the seed command to populate data</p></div>'}

                    ${namespaces.length > 0 ? `
                        <div class="chart-panel">
                            <div class="chart-title">Cost by Namespace</div>
                            <div class="chart-container" style="height:260px;position:relative">
                                <canvas id="breakdown-chart"></canvas>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Workload Telemetry History Modal Drawer -->
                <div id="workload-history-drawer" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.75);z-index:999;justify-content:flex-end">
                    <div style="width:680px;height:100vh;background:var(--bg-primary);border-left:1px solid var(--border-primary);padding:var(--space-2xl);overflow-y:auto;position:relative">
                        <button id="btn-close-drawer" class="btn btn-ghost" style="position:absolute;top:20px;right:20px;padding:4px 10px"> Esc</button>
                        
                        <div id="drawer-content">
                            <div class="loading-skeleton" style="height:300px"></div>
                        </div>
                    </div>
                </div>
            `;

            // Expand / collapse namespace rows
            container.querySelectorAll('.cost-tree-row.namespace').forEach(row => {
                row.addEventListener('click', () => {
                    const ns = row.dataset.ns;
                    if (expanded.has(ns)) expanded.delete(ns);
                    else expanded.add(ns);
                    render();
                });
            });

            // Click controller row -> Open Telemetry History Drawer
            container.querySelectorAll('.cost-tree-row.controller').forEach(row => {
                row.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const ns = row.dataset.ns;
                    const ctrl = row.dataset.ctrl;
                    const kind = row.dataset.kind;
                    openWorkloadHistory(ns, ctrl, kind);
                });
            });

            // Bar chart
            if (namespaces.length > 0) {
                setTimeout(() => {
                    const ctx = document.getElementById('breakdown-chart');
                    if (ctx) {
                        const colors = ['#6C5FC7', '#0969DA', '#E03E2F', '#F5A623', '#2DA44E', '#D97706', '#8B5CF6', '#6D657A'];
                        new Chart(ctx, {
                            type: 'bar',
                            data: {
                                labels: namespaces.map(ns => ns.namespace),
                                datasets: [{
                                    label: 'Cost/hr ($)',
                                    data: namespaces.map(ns => ns.total_cost),
                                    backgroundColor: namespaces.map((_, i) => colors[i % colors.length] + 'CC'),
                                    borderColor: namespaces.map((_, i) => colors[i % colors.length]),
                                    borderWidth: 1,
                                    borderRadius: 4,
                                }]
                            },
                            options: {
                                responsive: true, maintainAspectRatio: false,
                                indexAxis: 'y',
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: { grid: { color: '#2D2838' }, ticks: { color: '#6D657A', font: { size: 10 }, callback: v => '$' + v } },
                                    y: { grid: { display: false }, ticks: { color: '#E6E1F0', font: { size: 11 } } }
                                }
                            }
                        });
                    }
                    if (window.lucide) window.lucide.createIcons();
                }, 50);
            }
        }

        // Open Workload Telemetry History Drawer
        async function openWorkloadHistory(namespace, controller, kind, hours = 24) {
            selectedWorkload = { namespace, controller, kind };
            selectedRange = hours;

            const drawer = document.getElementById('workload-history-drawer');
            const drawerContent = document.getElementById('drawer-content');
            drawer.style.display = 'flex';
            drawerContent.innerHTML = `<div class="loading-skeleton" style="height:400px"></div>`;

            try {
                const history = await api.getCostHistory(namespace, controller, hours);

                drawerContent.innerHTML = `
                    <div style="margin-bottom:var(--space-xl)">
                        <div class="breadcrumb" style="margin-bottom:var(--space-xs)">
                            <span>${namespace}</span> <span class="sep">›</span> <span>${controller} (${kind})</span>
                        </div>
                        <h2 style="font-size:var(--text-2xl);color:var(--text-heading)">${controller} Cost History</h2>
                        <p style="font-size:var(--text-sm);color:var(--text-secondary)">Telemetry egress trend & network charges</p>
                    </div>

                    <!-- Filter Range Pills -->
                    <div style="display:flex;gap:var(--space-xs);margin-bottom:var(--space-lg)">
                        <button class="filter-pill ${hours === 24 ? 'active' : ''}" id="btn-range-24">Last 24 Hours</button>
                        <button class="filter-pill ${hours === 168 ? 'active' : ''}" id="btn-range-168">Last 7 Days</button>
                        <button class="filter-pill ${hours === 720 ? 'active' : ''}" id="btn-range-720">Last 30 Days</button>
                    </div>

                    <!-- Summary Cards -->
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-xl)">
                        <div class="score-card">
                            <div class="card-label">Total Period Cost</div>
                            <div class="card-value">$${(history.total_cost || 0).toFixed(2)}</div>
                        </div>
                        <div class="score-card">
                            <div class="card-label">Total Egress Volume</div>
                            <div class="card-value">${(history.total_egress_gb || 0).toFixed(2)} GB</div>
                        </div>
                    </div>

                    <!-- Chart -->
                    <div class="chart-panel" style="margin-bottom:var(--space-xl)">
                        <div class="chart-title">Cost History (${hours}h)</div>
                        <div class="chart-container" style="height:220px;position:relative">
                            <canvas id="drawer-history-chart"></canvas>
                        </div>
                    </div>

                    <!-- Telemetry Data Table -->
                    <h4 style="font-size:var(--text-md);color:var(--text-heading);margin-bottom:var(--space-md)">Telemetry Data Logs</h4>
                    <div class="table-container">
                        <table class="correlations-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Cost/hr</th>
                                    <th>Egress Volume</th>
                                    <th>Internet / NAT Cost</th>
                                    <th>Cross-AZ Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(history.data || []).map(dp => `
                                    <tr>
                                        <td style="font-family:var(--font-mono);font-size:var(--text-xs)">${dp.timestamp}</td>
                                        <td style="font-weight:700;font-variant-numeric:tabular-nums">$${dp.value.toFixed(2)}</td>
                                        <td style="font-variant-numeric:tabular-nums">${((dp.egress_bytes || 0) / (1024**3)).toFixed(2)} GB</td>
                                        <td style="font-variant-numeric:tabular-nums">$${(dp.internet_cost || 0).toFixed(2)}</td>
                                        <td style="font-variant-numeric:tabular-nums">$${(dp.cross_zone_cost || 0).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;

                // Wire up range buttons
                document.getElementById('btn-range-24')?.addEventListener('click', () => openWorkloadHistory(namespace, controller, kind, 24));
                document.getElementById('btn-range-168')?.addEventListener('click', () => openWorkloadHistory(namespace, controller, kind, 168));
                document.getElementById('btn-range-720')?.addEventListener('click', () => openWorkloadHistory(namespace, controller, kind, 720));

                // Close button handler
                document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
                    drawer.style.display = 'none';
                });

                // Render Chart
                setTimeout(() => {
                    const canvas = document.getElementById('drawer-history-chart');
                    if (canvas && history.data) {
                        const labels = history.data.map(d => d.timestamp);
                        const values = history.data.map(d => d.value);
                        ChartBuilder.createAreaChart(canvas, labels, values);
                    }
                }, 50);

            } catch (err) {
                drawerContent.innerHTML = `<div class="empty-state"><h3>Failed to load telemetry history</h3><p>${err.message}</p></div>`;
            }
        }

        // Keydown Esc handler to close drawer
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                const drawer = document.getElementById('workload-history-drawer');
                if (drawer) drawer.style.display = 'none';
            }
        };
        window.removeEventListener('keydown', handleKeyDown);
        window.addEventListener('keydown', handleKeyDown);

        render();
    } catch (err) {
        container.innerHTML = `<div class="page"><div class="empty-state"><h3>Backend Unavailable</h3><p>${err.message}</p></div></div>`;
    }
}
