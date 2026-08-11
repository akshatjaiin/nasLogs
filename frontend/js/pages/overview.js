import { api } from '../api.js';
import { ScoreCard } from '../components/ScoreCard.js';
import { SeverityBadge, SeverityDot } from '../components/SeverityBadge.js';
import { ChartBuilder } from '../components/ChartBuilder.js';

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
                    ${ScoreCard({ label: 'Open Incidents', value: summary.open_incidents_count, trendText: 'Active cost anomalies', trendType: 'up' })}
                    ${ScoreCard({ label: 'Critical', value: summary.critical_count, trendText: summary.critical_count > 0 ? '⚠ Immediate action required' : '✓ All clear', trendType: 'up', valueColor: 'var(--critical-content)' })}
                    ${ScoreCard({ label: 'Hourly Cost', value: `$${totalCost.toFixed(0)}`, trendText: 'Current burn rate', trendType: 'up' })}
                    ${ScoreCard({ label: 'Est. 24h Impact', value: `$${(totalCost * 24).toLocaleString('en-US', {maximumFractionDigits: 0})}`, trendText: 'Projected daily total', trendType: totalCost > 100 ? 'up' : 'flat' })}
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
                                        ${SeverityDot(inc.severity)}
                                        <div class="incident-info">
                                            <div class="incident-title">${inc.title} <span style="color:var(--critical-content);font-size:var(--text-xs)">(+${Math.round(pct)}%)</span></div>
                                            <div class="incident-meta">
                                                ${SeverityBadge(inc.status)}
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

        // Render main cost trend area chart using modular ChartBuilder
        setTimeout(() => {
            const chartCanvas = document.getElementById('cost-trend-chart');
            if (chartCanvas && costTrend.length > 0) {
                const labels = costTrend.map((_, i) => `${24 - i}h ago`).reverse();
                ChartBuilder.createAreaChart(chartCanvas, labels, costTrend);
            }

            // Render sparklines using modular ChartBuilder
            recentIncidents.forEach(inc => {
                const sparkCanvas = document.getElementById(`spark-dash-${inc.id}`);
                const history = (inc.evidence || {}).cost_history || [];
                if (sparkCanvas && history.length > 0) {
                    const values = history.map(h => typeof h === 'object' ? h.value : h);
                    ChartBuilder.createSparkline(sparkCanvas, values, inc.severity === 'critical');
                }
            });
        }, 50);
    } catch (err) {
        container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">❌</div><h3>Backend Unavailable</h3><p>Make sure Django is running: <code>python manage.py runserver</code></p><p style="color:var(--text-disabled);margin-top:8px">${err.message}</p></div></div>`;
    }
}
