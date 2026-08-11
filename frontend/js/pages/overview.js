import { api } from '../api.js';

export async function renderOverview(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:400px;margin-top:24px"></div></div>`;
    
    try {
        const summary = await api.getDashboardSummary();
        const costTrend = summary.cost_history_24h || [];
        const totalCost = summary.total_hourly_cost || 0;
        const recentIncidents = summary.recent_incidents || [];

        container.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">Overview</h1>
                    <p class="page-subtitle">Network cost health & incident telemetry across all clusters</p>
                </div>

                <div class="grid-4">
                    <div class="score-card">
                        <div class="card-label">Open Incidents</div>
                        <div class="card-value">${summary.open_incidents_count}</div>
                        <div class="card-trend up">Active cost anomalies</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">Critical</div>
                        <div class="card-value" style="color:var(--critical-content)">${summary.critical_count}</div>
                        <div class="card-trend up">${summary.critical_count > 0 ? '⚠ Immediate action required' : '✓ All clear'}</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">Hourly Cost</div>
                        <div class="card-value">$${totalCost.toFixed(0)}</div>
                        <div class="card-trend up">Current burn rate</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">Est. 24h Impact</div>
                        <div class="card-value">$${(totalCost * 24).toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
                        <div class="card-trend ${totalCost > 100 ? 'up' : 'flat'}">Projected daily total</div>
                    </div>
                </div>

                <div class="chart-panel">
                    <div class="chart-title">
                        <span>Network Cost — Last 24 Hours</span>
                        <span style="font-size:var(--text-xs);font-weight:400;color:var(--text-secondary)">Aggregated hourly egress</span>
                    </div>
                    <div class="chart-container">
                        <canvas id="cost-trend-chart"></canvas>
                    </div>
                </div>

                <div class="section">
                    <h3 class="section-title">🔥 Recent Open Incidents</h3>
                    ${recentIncidents.length > 0 ? `
                        <div class="incident-list">
                            ${recentIncidents.map(inc => {
                                const ev = inc.evidence || {};
                                const anomaly = ev.anomaly || {};
                                const pct = anomaly.deviation_pct || 0;
                                const spike = anomaly.spike || 0;
                                const baseline = anomaly.baseline || 0;
                                return `
                                    <div class="incident-row" onclick="window.navigateTo('/incidents/${inc.id}')">
                                        <div class="severity-dot ${inc.severity}"></div>
                                        <div class="incident-info">
                                            <div class="incident-title">${inc.title} <span style="color:var(--critical-content);font-size:var(--text-xs)">(+${Math.round(pct)}%)</span></div>
                                            <div class="incident-meta">
                                                <span class="severity-badge ${inc.status}">${inc.status}</span>
                                                <span class="meta-sep">·</span>
                                                <span>${new Date(inc.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                        </div>
                                        <div class="sparkline-container"><canvas id="spark-dash-${inc.id}" height="32"></canvas></div>
                                        <div class="incident-cost">
                                            <div class="cost-current">$${spike.toFixed(2)}/hr</div>
                                            <div class="cost-change spike">was $${baseline.toFixed(2)}</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : '<div class="empty-state"><div class="empty-icon">✅</div><h3>No open incidents</h3><p>All clear — network traffic matches baselines</p></div>'}
                </div>
            </div>
        `;

        // Render main cost trend area chart with rich gradient fill
        setTimeout(() => {
            const ctx = document.getElementById('cost-trend-chart');
            if (ctx && costTrend.length > 0) {
                const chartCanvas = ctx.getContext('2d');
                const gradient = chartCanvas.createLinearGradient(0, 0, 0, 220);
                gradient.addColorStop(0, 'rgba(117, 83, 255, 0.35)');
                gradient.addColorStop(1, 'rgba(117, 83, 255, 0.0)');

                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: costTrend.map((_, i) => `${24 - i}h ago`).reverse(),
                        datasets: [{
                            data: costTrend,
                            borderColor: '#7553FF',
                            backgroundColor: gradient,
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 5,
                            pointHoverBackgroundColor: '#FFFFFF',
                            pointHoverBorderColor: '#7553FF',
                            pointHoverBorderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: '#2E2936',
                                titleColor: '#FFFFFF',
                                bodyColor: '#B5B0BD',
                                borderColor: '#393442',
                                borderWidth: 1,
                                padding: 10,
                                cornerRadius: 6,
                                displayColors: false,
                                callbacks: { label: (ctx) => `Network Cost: $${ctx.parsed.y.toFixed(2)}/hr` }
                            }
                        },
                        scales: {
                            x: { grid: { color: '#24202B' }, ticks: { color: '#787383', font: { size: 10 } } },
                            y: { grid: { color: '#24202B' }, ticks: { color: '#787383', font: { size: 10 }, callback: v => '$' + v } }
                        }
                    }
                });
            }

            // Sparklines for recent incidents
            recentIncidents.forEach(inc => {
                const sparkCtx = document.getElementById(`spark-dash-${inc.id}`);
                const history = (inc.evidence || {}).cost_history || [];
                if (sparkCtx && history.length > 0) {
                    const values = history.map(h => typeof h === 'object' ? h.value : h);
                    new Chart(sparkCtx, {
                        type: 'line',
                        data: {
                            labels: values.map((_, i) => i),
                            datasets: [{
                                data: values,
                                borderColor: inc.severity === 'critical' ? '#FF002B' : '#FFCE00',
                                backgroundColor: inc.severity === 'critical' ? 'rgba(255,0,43,0.1)' : 'rgba(255,206,0,0.1)',
                                fill: true, tension: 0.3, borderWidth: 1.5, pointRadius: 0
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: { enabled: false } },
                            scales: { x: { display: false }, y: { display: false } }
                        }
                    });
                }
            });
        }, 50);
    } catch (err) {
        container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">❌</div><h3>Backend Unavailable</h3><p>Make sure Django is running: <code>python manage.py runserver</code></p><p style="color:var(--text-disabled);margin-top:8px">${err.message}</p></div></div>`;
    }
}
