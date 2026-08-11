import { mockIncidents } from '../mock-data.js';

export function renderIncidentDetail(container, params) {
    const incident = mockIncidents.find(i => i.id === parseInt(params.id));
    if (!incident) {
        container.innerHTML = '<div class="page"><div class="empty-state"><div class="empty-icon">🔍</div><h3>Incident not found</h3></div></div>';
        return;
    }

    const ev = incident.evidence;
    const correlations = ev.correlations || [];
    const topCorr = correlations[0];

    container.innerHTML = `
        <div class="page">
            <div class="breadcrumb">
                <a href="#/incidents">Cost Incidents</a>
                <span class="sep">›</span>
                <span>${incident.namespace}/${incident.controller}</span>
            </div>

            <div class="detail-header">
                <div class="title-section">
                    <h1 class="incident-title-large">
                        ${incident.severity === 'critical' ? '🚨' : '⚠️'} ${incident.title} (+${incident.deviation_pct}%)
                    </h1>
                    <div class="title-badges">
                        <span class="severity-badge ${incident.status}">${incident.status}</span>
                        <span class="severity-badge ${incident.severity}">${incident.severity}</span>
                        <span style="color:var(--text-secondary);font-size:var(--text-sm)">${incident.first_seen} · Impact: ${incident.cost_impact}</span>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-ghost" onclick="this.textContent='✓ Acknowledged';this.classList.add('btn-success')">
                        Acknowledge
                    </button>
                    <button class="btn btn-success" onclick="this.textContent='✓ Resolved';this.disabled=true">
                        Resolve
                    </button>
                    <button class="btn btn-ghost">Ignore</button>
                </div>
            </div>

            <!-- BLAME TRAIL -->
            <div class="blame-trail">
                <div class="blame-trail-header">
                    <h3>🔍 Blame Trail — What Happened</h3>
                    <span style="font-size:var(--text-sm);color:var(--text-secondary)">±30 min window around spike</span>
                </div>
                <div class="trail-timeline">
                    <div class="trail-ruler">
                        <span>-30m</span><span>-20m</span><span>-10m</span><span>Spike</span><span>+10m</span><span>+20m</span><span>+30m</span>
                    </div>

                    <!-- Baseline bar -->
                    <div class="trail-event">
                        <div class="trail-event-label">
                            <span class="event-icon" style="background:var(--event-baseline)"></span>
                            Baseline Cost
                        </div>
                        <div class="trail-event-bar-container">
                            <div class="trail-event-bar baseline" style="left:0;width:50%;">
                                $${incident.baseline_value.toFixed(2)}/hr
                            </div>
                            <div class="trail-spike-marker" style="left:50%"></div>
                        </div>
                    </div>

                    <!-- Spike bar -->
                    <div class="trail-event">
                        <div class="trail-event-label">
                            <span class="event-icon" style="background:var(--event-spike)"></span>
                            Cost Spike
                        </div>
                        <div class="trail-event-bar-container">
                            <div class="trail-event-bar spike" style="left:45%;width:55%;">
                                $${incident.spike_value.toFixed(2)}/hr (+${incident.deviation_pct}%)
                            </div>
                            <div class="trail-spike-marker" style="left:50%"></div>
                        </div>
                    </div>

                    ${correlations.map((corr, i) => {
                        const deltaMin = Math.abs(corr.time_delta_seconds / 60);
                        const isBefore = corr.time_delta_seconds < 0;
                        const position = 50 + (corr.time_delta_seconds / 1800 * 50);
                        const barWidth = Math.max(8, 15 - i * 3);
                        const eventColor = corr.event_kind === 'deployment' ? 'deployment' : 
                                          corr.event_kind === 'configmap' ? 'configmap' :
                                          corr.event_kind === 'hpa' ? 'scale' : 'unknown';
                        return `
                            <div class="trail-event">
                                <div class="trail-event-label">
                                    <span class="event-icon" style="background:var(--event-${eventColor})"></span>
                                    ${corr.event_kind}: ${corr.event_name}
                                </div>
                                <div class="trail-event-bar-container">
                                    <div class="trail-event-bar ${eventColor}" style="left:${Math.max(0, position)}%;width:${barWidth}%;">
                                        ${deltaMin.toFixed(0)}m ${isBefore ? 'before' : 'after'}
                                    </div>
                                    <div class="trail-spike-marker" style="left:50%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- EVIDENCE -->
            <div class="evidence-grid">
                <div class="evidence-card">
                    <div class="card-header">
                        <h4>💰 Anomaly</h4>
                        <span class="severity-badge ${incident.severity}">${incident.severity}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Baseline</span>
                        <span class="stat-value">$${ev.anomaly.baseline.toFixed(2)}/hr</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Current Spike</span>
                        <span class="stat-value spike">$${ev.anomaly.spike.toFixed(2)}/hr</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Deviation</span>
                        <span class="stat-value spike">+${ev.anomaly.deviation_pct}%</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Method</span>
                        <span class="stat-value" style="font-size:var(--text-sm)">${ev.anomaly.method}</span>
                    </div>
                </div>

                <div class="evidence-card">
                    <div class="card-header">
                        <h4>🎯 Likely Cause</h4>
                        ${topCorr ? `<span class="confidence-badge">${(topCorr.confidence * 100).toFixed(0)}% match</span>` : ''}
                    </div>
                    ${topCorr ? `
                        <div class="stat-row">
                            <span class="stat-label">Event</span>
                            <span class="stat-value" style="font-size:var(--text-md)">${topCorr.event_kind} ${topCorr.event_action}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Resource</span>
                            <span class="stat-value" style="font-size:var(--text-md)">${topCorr.event_name}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Timing</span>
                            <span class="stat-value" style="font-size:var(--text-md)">${Math.abs(topCorr.time_delta_seconds / 60).toFixed(0)}m ${topCorr.time_delta_seconds < 0 ? 'before' : 'after'} spike</span>
                        </div>
                        <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-top:var(--space-md)">${topCorr.explanation}</p>
                        <div class="confidence-bar" style="margin-top:var(--space-md)">
                            <div class="fill" style="width:${topCorr.confidence * 100}%"></div>
                        </div>
                    ` : '<p style="color:var(--text-secondary)">No deployment or configuration changes found near the spike</p>'}
                </div>

                <div class="evidence-card">
                    <div class="card-header">
                        <h4>📊 Cost History</h4>
                        <span style="font-size:var(--text-xs);color:var(--text-disabled)">24h</span>
                    </div>
                    <canvas id="detail-sparkline" height="120"></canvas>
                </div>
            </div>

            ${correlations.length > 0 ? `
            <div class="section">
                <h3 class="section-title">🔗 All Correlated Events</h3>
                <div class="panel">
                    <table class="correlations-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Event</th>
                                <th>Resource</th>
                                <th>Confidence</th>
                                <th>Time Delta</th>
                                <th>Explanation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${correlations.map((corr, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td><span class="severity-badge" style="background:var(--info-surface);color:var(--info-content)">${corr.event_kind} ${corr.event_action}</span></td>
                                    <td style="font-family:var(--font-mono);font-size:var(--text-sm)">${corr.event_name}</td>
                                    <td>
                                        <div style="display:flex;align-items:center;gap:var(--space-sm)">
                                            <div class="confidence-bar" style="width:60px;margin:0"><div class="fill" style="width:${corr.confidence * 100}%"></div></div>
                                            <span style="font-variant-numeric:tabular-nums">${(corr.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td style="font-variant-numeric:tabular-nums">${corr.time_delta_seconds < 0 ? '' : '+'}${(corr.time_delta_seconds / 60).toFixed(0)} min</td>
                                    <td style="font-size:var(--text-sm);color:var(--text-secondary);max-width:300px">${corr.explanation}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
        </div>
    `;

    // Render detail sparkline
    setTimeout(() => {
        const ctx = document.getElementById('detail-sparkline');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: incident.sparkline_data.map((_, i) => `${24 - i}h ago`),
                    datasets: [{
                        data: incident.sparkline_data,
                        borderColor: incident.severity === 'critical' ? '#FF002B' : '#FFCE00',
                        backgroundColor: incident.severity === 'critical' ? 'rgba(255,0,43,0.15)' : 'rgba(255,206,0,0.15)',
                        fill: true, tension: 0.3, borderWidth: 2, pointRadius: 0,
                        pointHoverRadius: 4, pointHoverBackgroundColor: '#fff'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: {
                        backgroundColor: '#393442', titleColor: '#E7E5EA', bodyColor: '#B5B0BD',
                        borderColor: '#534D5E', borderWidth: 1, padding: 10, cornerRadius: 6,
                        callbacks: { label: (ctx) => `$${ctx.parsed.y.toFixed(2)}/hr` }
                    }},
                    scales: {
                        x: { display: false },
                        y: { grid: { color: '#1B1821' }, ticks: { color: '#958E9F', font: { size: 10 }, callback: v => '$' + v } }
                    }
                }
            });
        }
    }, 50);
}
