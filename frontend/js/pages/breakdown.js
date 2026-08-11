import { api } from '../api.js';

export async function renderBreakdown(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:600px;margin:24px"></div></div>`;
    
    try {
        const data = await api.getCostBreakdown();
        const namespaces = data.namespaces || [];
        const expanded = new Set();
        
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
                                <span>Namespace / Controller</span>
                                <span>Cost/hr</span>
                                <span>Change</span>
                                <span></span>
                            </div>
                            <div class="cost-tree">
                                ${namespaces.map(ns => `
                                    <div class="cost-tree-row namespace" data-ns="${ns.namespace}">
                                        <span>
                                            <span class="tree-toggle ${expanded.has(ns.namespace) ? 'expanded' : ''}" data-toggle="${ns.namespace}">▶</span>
                                            ${ns.namespace}
                                            <span style="color:var(--text-disabled);font-size:var(--text-xs)">(${(ns.controllers || []).length})</span>
                                        </span>
                                        <span style="font-variant-numeric:tabular-nums;font-weight:700">$${ns.total_cost.toFixed(2)}</span>
                                        <span class="cost-delta ${getDeltaClass(ns.delta_pct)}">${getDeltaArrow(ns.delta_pct)} ${ns.delta_pct > 0 ? '+' : ''}${ns.delta_pct}%</span>
                                        <span></span>
                                    </div>
                                    ${expanded.has(ns.namespace) ? (ns.controllers || []).map(ctrl => `
                                        <div class="cost-tree-row controller">
                                            <span>└ ${ctrl.name} <span style="color:var(--text-disabled);font-size:var(--text-xs)">(${ctrl.kind})</span></span>
                                            <span style="font-variant-numeric:tabular-nums">$${ctrl.cost.toFixed(2)}</span>
                                            <span class="cost-delta ${getDeltaClass(ctrl.delta_pct)}">${getDeltaArrow(ctrl.delta_pct)} ${ctrl.delta_pct > 0 ? '+' : ''}${ctrl.delta_pct}%</span>
                                            <span></span>
                                        </div>
                                    `).join('') : ''}
                                `).join('')}
                            </div>
                        </div>
                    ` : '<div class="empty-state"><div class="empty-icon">📊</div><h3>No cost data yet</h3><p>Run the seed command to populate data</p></div>'}

                    ${namespaces.length > 0 ? `
                        <div class="chart-panel">
                            <div class="chart-title">Cost by Namespace</div>
                            <canvas id="breakdown-chart" height="250"></canvas>
                        </div>
                    ` : ''}
                </div>
            `;

            // Toggle handlers
            container.querySelectorAll('.cost-tree-row.namespace').forEach(row => {
                row.addEventListener('click', () => {
                    const ns = row.dataset.ns;
                    if (expanded.has(ns)) expanded.delete(ns);
                    else expanded.add(ns);
                    render();
                });
            });

            // Bar chart
            if (namespaces.length > 0) {
                setTimeout(() => {
                    const ctx = document.getElementById('breakdown-chart');
                    if (ctx) {
                        const colors = ['#7553FF', '#00A7FF', '#FF002B', '#FFCE00', '#00F261', '#FF8C00', '#6048D0', '#898294'];
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
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        backgroundColor: '#393442', titleColor: '#E7E5EA', bodyColor: '#B5B0BD',
                                        borderColor: '#534D5E', borderWidth: 1, padding: 12, cornerRadius: 6,
                                        callbacks: { label: (ctx) => `$${ctx.parsed.x.toFixed(2)}/hr` }
                                    }
                                },
                                scales: {
                                    x: { grid: { color: '#1B1821' }, ticks: { color: '#958E9F', font: { size: 11 }, callback: v => '$' + v } },
                                    y: { grid: { display: false }, ticks: { color: '#E7E5EA', font: { size: 12 } } }
                                }
                            }
                        });
                    }
                }, 50);
            }
        }

        render();
    } catch (err) {
        container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">❌</div><h3>Backend Unavailable</h3><p>${err.message}</p></div></div>`;
    }
}
