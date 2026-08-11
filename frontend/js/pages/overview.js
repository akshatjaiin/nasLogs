import { api } from '../api.js';

export async function renderOverview(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:400px;margin:24px"></div></div>`;
    
    try {
        const summary = await api.getDashboardSummary();
        const costTrend = summary.cost_history_24h || [];
        const totalCost = summary.total_hourly_cost || 0;
        const recentIncidents = summary.recent_incidents || [];

        container.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">Overview</h1>
                    <p class="page-subtitle">Network cost health across all clusters</p>
                </div>

                <div class="grid-4">
                    <div class="score-card">
                        <div class="card-label">Open Incidents</div>
                        <div class="card-value">${summary.open_incidents_count}</div>
                        <div class="card-trend up">Active alerts</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">Critical</div>
                        <div class="card-value" style="color:var(--critical-content)">${summary.critical_count}</div>
                        <div class="card-trend up">${summary.critical_count > 0 ? '⚠ Needs attention' : '✓ All clear'}</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">Hourly Cost</div>
                        <div class="card-value">$${totalCost.toFixed(0)}</div>
                        <div class="card-trend up">Current rate</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">Est. 24h Impact</div>
                        <div class="card-value">$${(totalCost * 24).toFixed(0)}</div>
                        <div class="card-trend ${totalCost > 100 ? 'up' : 'flat'}">Projected</div>
                    </div>
                </div>

                <div class="chart-panel">
                    <div class="chart-title">Network Cost — Last 24 Hours</div>
                    <canvas id="cost-trend-chart" height="200"></canvas>
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
                                    <div class="incident-row" onclick="window.location.hash='/incidents/${inc.id}'">
                                        <div class="severity-dot ${inc.severity}"></div>
                                        <div class="incident-info">
                                            <div class="incident-title">${inc.title} <span style="color:var(--critical-content)">(+${Math.round(pct)}%)</span></div>
                                            <div class="incident-meta">
                                                <span class="severity-badge ${inc.status}">${inc.status}</span>
                                                <span class="meta-sep">·</span>
                                                <span>${new Date(inc.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div class="incident-cost">
                                            <div class="cost-current">$${spike.toFixed(2)}/hr</div>
                                            <div class="cost-change spike">was $${baseline.toFixed(2)}</div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : '<div class="empty-state"><div class="empty-icon">✅</div><h3>No open incidents</h3><p>All clear — no cost spikes detected</p></div>'}
                </div>
            </div>
        `;

        // Render cost trend chart
        setTimeout(() => {
            const ctx = document.getElementById('cost-trend-chart');
            if (ctx && costTrend.length > 0) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: costTrend.map((_, i) => `${24 - i}h ago`).reverse(),
                        datasets: [{
                            data: costTrend,
                            borderColor: '#7553FF',
                            backgroundColor: 'rgba(117, 83, 255, 0.1)',
                            fill: true, tension: 0.4, borderWidth: 2,
                            pointRadius: 0, pointHoverRadius: 4,
                            pointHoverBackgroundColor: '#7553FF'
                        }]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: {
                            backgroundColor: '#393442', titleColor: '#E7E5EA', bodyColor: '#B5B0BD',
                            borderColor: '#534D5E', borderWidth: 1, padding: 12, cornerRadius: 6,
                            callbacks: { label: (ctx) => `$${ctx.parsed.y.toFixed(2)}/hr` }
                        }},
                        scales: {
                            x: { grid: { color: '#1B1821' }, ticks: { color: '#958E9F', font: { size: 11 } } },
                            y: { grid: { color: '#1B1821' }, ticks: { color: '#958E9F', font: { size: 11 }, callback: v => '$' + v } }
                        }
                    }
                });
            }
        }, 50);
    } catch (err) {
        container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">❌</div><h3>Backend Unavailable</h3><p>Make sure Django is running: <code>python manage.py runserver</code></p><p style="color:var(--text-disabled);margin-top:8px">${err.message}</p></div></div>`;
    }
}
