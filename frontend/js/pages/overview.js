import { mockIncidents, mockSummary } from '../mock-data.js';

export function renderOverview(container) {
    const openIncidents = mockIncidents.filter(i => i.status !== 'resolved');
    const criticalCount = openIncidents.filter(i => i.severity === 'critical').length;

    container.innerHTML = `
        <div class="page">
            <div class="page-header">
                <h1 class="page-title">Overview</h1>
                <p class="page-subtitle">Network cost health across all clusters</p>
            </div>

            <div class="grid-4">
                <div class="score-card">
                    <div class="card-label">Open Incidents</div>
                    <div class="card-value">${mockSummary.open_incidents}</div>
                    <div class="card-trend up">↑ 2 new in 24h</div>
                </div>
                <div class="score-card">
                    <div class="card-label">Critical</div>
                    <div class="card-value" style="color:var(--critical-content)">${criticalCount}</div>
                    <div class="card-trend up">↑ Needs attention</div>
                </div>
                <div class="score-card">
                    <div class="card-label">Hourly Cost</div>
                    <div class="card-value">$${mockSummary.total_hourly_cost.toFixed(0)}</div>
                    <div class="card-trend up">↑ +${mockSummary.cost_trend_pct}% vs 7d avg</div>
                </div>
                <div class="score-card">
                    <div class="card-label">Est. 24h Impact</div>
                    <div class="card-value">$${(mockSummary.total_hourly_cost * 24).toFixed(0)}</div>
                    <div class="card-trend up">↑ Above baseline</div>
                </div>
            </div>

            <div class="chart-panel">
                <div class="chart-title">Network Cost — Last 24 Hours</div>
                <canvas id="cost-trend-chart" height="200"></canvas>
            </div>

            <div class="section">
                <h3 class="section-title">🔥 Recent Critical Incidents</h3>
                <div class="incident-list">
                    ${openIncidents.slice(0, 5).map(inc => `
                        <div class="incident-row" onclick="window.location.hash='/incidents/${inc.id}'">
                            <div class="severity-dot ${inc.severity}"></div>
                            <div class="incident-info">
                                <div class="incident-title">${inc.title} <span style="color:var(--critical-content)">(+${inc.deviation_pct}%)</span></div>
                                <div class="incident-meta">
                                    <span>${inc.first_seen}</span>
                                    <span class="meta-sep">·</span>
                                    <span>${inc.evidence.workload.controller_kind}</span>
                                    <span class="meta-sep">·</span>
                                    <span>Impact: ${inc.cost_impact}</span>
                                </div>
                            </div>
                            <div class="sparkline-container"><canvas id="spark-${inc.id}" height="36"></canvas></div>
                            <div class="incident-cost">
                                <div class="cost-current">$${inc.spike_value.toFixed(2)}/hr</div>
                                <div class="cost-change spike">↑ from $${inc.baseline_value.toFixed(2)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Render cost trend chart
    setTimeout(() => {
        const ctx = document.getElementById('cost-trend-chart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: Array.from({length: 24}, (_, i) => `${i}h ago`).reverse(),
                    datasets: [{
                        data: mockSummary.cost_history_24h,
                        borderColor: '#7553FF',
                        backgroundColor: 'rgba(117, 83, 255, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#7553FF'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
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

        // Sparklines
        openIncidents.slice(0, 5).forEach(inc => {
            const sparkCtx = document.getElementById(`spark-${inc.id}`);
            if (sparkCtx) {
                new Chart(sparkCtx, {
                    type: 'line',
                    data: {
                        labels: inc.sparkline_data.map((_, i) => i),
                        datasets: [{
                            data: inc.sparkline_data,
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
}
