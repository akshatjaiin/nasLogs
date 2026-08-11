import { mockBreakdown } from '../mock-data.js';

export function renderBreakdown(container) {
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
        const totalCost = mockBreakdown.reduce((sum, ns) => sum + ns.total_cost, 0);

        container.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">Cost Breakdown</h1>
                    <p class="page-subtitle">Namespace-level network cost with drill-down to controllers</p>
                </div>

                <div class="toolbar">
                    <div class="toolbar-left">
                        <span style="font-size:var(--text-sm);color:var(--text-secondary)">Total hourly: <strong style="color:var(--text-heading)">$${totalCost.toFixed(2)}/hr</strong></span>
                    </div>
                    <div class="toolbar-right">
                        <select class="time-select">
                            <option>vs 7 days ago</option>
                            <option>vs 24 hours ago</option>
                            <option>vs 30 days ago</option>
                        </select>
                    </div>
                </div>

                <div class="panel">
                    <div class="cost-tree-header">
                        <span>Namespace / Controller</span>
                        <span>Cost/hr</span>
                        <span>Change</span>
                        <span>Trend</span>
                    </div>
                    <div class="cost-tree">
                        ${mockBreakdown.map(ns => `
                            <div class="cost-tree-row namespace" data-ns="${ns.namespace}">
                                <span>
                                    <span class="tree-toggle ${expanded.has(ns.namespace) ? 'expanded' : ''}" data-toggle="${ns.namespace}">▶</span>
                                    ${ns.namespace}
                                </span>
                                <span style="font-variant-numeric:tabular-nums">$${ns.total_cost.toFixed(2)}</span>
                                <span class="cost-delta ${getDeltaClass(ns.delta_pct)}">${getDeltaArrow(ns.delta_pct)} ${ns.delta_pct > 0 ? '+' : ''}${ns.delta_pct}%</span>
                                <span><canvas id="tree-spark-${ns.namespace}" width="120" height="24"></canvas></span>
                            </div>
                            ${expanded.has(ns.namespace) ? ns.controllers.map(ctrl => `
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

                <div class="chart-panel">
                    <div class="chart-title">Cost by Namespace — Last 24 Hours</div>
                    <canvas id="breakdown-chart" height="250"></canvas>
                </div>
            </div>
        `;

        // Toggle handlers
        container.querySelectorAll('.tree-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const ns = toggle.dataset.toggle;
                if (expanded.has(ns)) expanded.delete(ns);
                else expanded.add(ns);
                render();
            });
        });

        container.querySelectorAll('.cost-tree-row.namespace').forEach(row => {
            row.addEventListener('click', () => {
                const ns = row.dataset.ns;
                if (expanded.has(ns)) expanded.delete(ns);
                else expanded.add(ns);
                render();
            });
        });

        // Breakdown stacked chart
        setTimeout(() => {
            const ctx = document.getElementById('breakdown-chart');
            if (ctx) {
                const colors = ['#7553FF', '#00A7FF', '#FF002B', '#FFCE00', '#00F261', '#FF8C00'];
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: Array.from({length: 24}, (_, i) => `${23-i}h`).reverse(),
                        datasets: mockBreakdown.map((ns, i) => ({
                            label: ns.namespace,
                            data: Array.from({length: 24}, (_, j) => {
                                const base = ns.total_cost * (0.8 + Math.random() * 0.4);
                                return j >= 12 ? base : base * (1 + ns.delta_pct / 100);
                            }),
                            backgroundColor: colors[i % colors.length] + '88',
                            borderColor: colors[i % colors.length],
                            borderWidth: 1,
                        }))
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: {
                            legend: { position: 'bottom', labels: { color: '#B5B0BD', padding: 16, font: { size: 11 } } },
                            tooltip: { backgroundColor: '#393442', titleColor: '#E7E5EA', bodyColor: '#B5B0BD', borderColor: '#534D5E', borderWidth: 1, padding: 12, cornerRadius: 6 }
                        },
                        scales: {
                            x: { stacked: true, grid: { color: '#1B1821' }, ticks: { color: '#958E9F', font: { size: 10 } } },
                            y: { stacked: true, grid: { color: '#1B1821' }, ticks: { color: '#958E9F', font: { size: 10 }, callback: v => '$' + v } }
                        }
                    }
                });
            }
        }, 50);
    }

    render();
}
