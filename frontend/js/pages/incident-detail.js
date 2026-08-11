import { api } from '../api.js';

export async function renderIncidentDetail(container, params) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:600px;margin:24px"></div></div>`;
    
    try {
        const incident = await api.getIncident(params.id);
        const ev = incident.evidence || {};
        const anomaly = ev.anomaly || {};
        const workload = ev.workload || {};
        const correlations = ev.correlations || [];
        const costHistory = ev.cost_history || [];
        const topCorr = correlations[0];

        container.innerHTML = `
            <div class="page">
                <div class="breadcrumb">
                    <a href="/incidents" data-link>Cost Incidents</a>
                    <span class="sep">›</span>
                    <span>${workload.namespace || ''}/${workload.controller || ''}</span>
                </div>

                <div class="detail-header">
                    <div class="title-section">
                        <h1 class="incident-title-large">
                            ${incident.title} (+${Math.round(anomaly.deviation_pct || 0)}%)
                        </h1>
                        <div class="title-badges">
                            <span class="severity-badge ${incident.status}">${incident.status}</span>
                            <span class="severity-badge ${incident.severity}">${incident.severity}</span>
                            <span style="color:var(--text-secondary);font-size:var(--text-sm)">
                                ${timeAgo(incident.created_at)} · Est. impact: $${((anomaly.spike || 0) * 24).toFixed(0)}/day
                            </span>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-ghost" id="btn-ack" ${incident.status !== 'open' ? 'disabled' : ''}>
                            ${incident.status === 'acknowledged' ? ' Acknowledged' : 'Acknowledge'}
                        </button>
                        <button class="btn btn-success" id="btn-resolve" ${incident.status === 'resolved' ? 'disabled' : ''}>
                            ${incident.status === 'resolved' ? ' Resolved' : 'Resolve'}
                        </button>
                    </div>
                </div>

                <!-- BLAME TRAIL -->
                <div class="blame-trail">
                    <div class="blame-trail-header">
                        <h3>Blame Trail — Root Cause Correlation</h3>
                        <span style="font-size:var(--text-sm);color:var(--text-secondary)">±30 min temporal window</span>
                    </div>
                    <div class="trail-timeline">
                        <div class="trail-ruler">
                            <span>-30m</span><span>-20m</span><span>-10m</span><span>Spike</span><span>+10m</span><span>+20m</span><span>+30m</span>
                        </div>

                        <div class="trail-event">
                            <div class="trail-event-label">
                                <span class="event-icon" style="background:var(--event-baseline)"></span>
                                Baseline Cost
                            </div>
                            <div class="trail-event-bar-container">
                                <div class="trail-event-bar baseline" style="left:0;width:50%;">
                                    $${(anomaly.baseline || 0).toFixed(2)}/hr
                                </div>
                                <div class="trail-spike-marker" style="left:50%"></div>
                            </div>
                        </div>

                        <div class="trail-event">
                            <div class="trail-event-label">
                                <span class="event-icon" style="background:var(--event-spike)"></span>
                                Cost Spike
                            </div>
                            <div class="trail-event-bar-container">
                                <div class="trail-event-bar spike" style="left:45%;width:55%;">
                                    $${(anomaly.spike || 0).toFixed(2)}/hr (+${Math.round(anomaly.deviation_pct || 0)}%)
                                </div>
                                <div class="trail-spike-marker" style="left:50%"></div>
                            </div>
                        </div>

                        ${correlations.map((corr, i) => {
                            const deltaMin = Math.abs((corr.time_delta_seconds || 0) / 60);
                            const isBefore = (corr.time_delta_seconds || 0) < 0;
                            const position = 50 + ((corr.time_delta_seconds || 0) / 1800 * 50);
                            const barWidth = Math.max(8, 18 - i * 4);
                            const kind = (corr.event_kind || corr.event || '').toLowerCase();
                            const eventColor = kind.includes('deploy') ? 'deployment' : 
                                               kind.includes('config') ? 'configmap' :
                                               kind.includes('hpa') || kind.includes('scale') ? 'scale' :
                                               kind.includes('stateful') ? 'deployment' : 'unknown';
                            return `
                                <div class="trail-event">
                                    <div class="trail-event-label">
                                        <span class="event-icon" style="background:var(--event-${eventColor})"></span>
                                        ${corr.event_kind || 'event'}: ${corr.event_name || corr.event || 'unknown'}
                                    </div>
                                    <div class="trail-event-bar-container">
                                        <div class="trail-event-bar ${eventColor}" style="left:${Math.max(0, Math.min(85, position))}%;width:${barWidth}%;">
                                            ${deltaMin.toFixed(0)}m ${isBefore ? 'before' : 'after'}
                                        </div>
                                        <div class="trail-spike-marker" style="left:50%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}

                        ${correlations.length === 0 ? `
                            <div style="padding:var(--space-xl);text-align:center;color:var(--text-secondary)">
                                No K8s audit events found near the spike — root cause unassigned
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- EVIDENCE -->
                <div class="evidence-grid">
                    <div class="evidence-card">
                        <div class="card-header">
                            <h4>Anomaly Metrics</h4>
                            <span class="severity-badge ${incident.severity}">${incident.severity}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Baseline</span>
                            <span class="stat-value">$${(anomaly.baseline || 0).toFixed(2)}/hr</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Current Spike</span>
                            <span class="stat-value spike">$${(anomaly.spike || 0).toFixed(2)}/hr</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Deviation</span>
                            <span class="stat-value spike">+${Math.round(anomaly.deviation_pct || 0)}%</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Detection Algorithm</span>
                            <span class="stat-value" style="font-size:var(--text-sm)">${anomaly.method || 'pct_change'}</span>
                        </div>
                    </div>

                    <div class="evidence-card">
                        <div class="card-header">
                            <h4>Likely Root Cause</h4>
                            ${topCorr ? `<span class="confidence-badge">${Math.round((topCorr.confidence || 0) * 100)}% match</span>` : ''}
                        </div>
                        ${topCorr ? `
                            <div class="stat-row">
                                <span class="stat-label">Event</span>
                                <span class="stat-value" style="font-size:var(--text-md)">${topCorr.event_kind || ''} ${topCorr.event_action || ''}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Resource</span>
                                <span class="stat-value" style="font-size:var(--text-md)">${topCorr.event_name || topCorr.event || ''}</span>
                            </div>
                            <div class="stat-row">
                                <span class="stat-label">Timing</span>
                                <span class="stat-value" style="font-size:var(--text-md)">${Math.abs((topCorr.time_delta_seconds || 0) / 60).toFixed(0)}m ${(topCorr.time_delta_seconds || 0) < 0 ? 'before' : 'after'} spike</span>
                            </div>
                            <p style="font-size:var(--text-sm);color:var(--text-secondary);margin-top:var(--space-md)">${topCorr.explanation || ''}</p>
                            <div class="confidence-bar" style="margin-top:var(--space-md)">
                                <div class="fill" style="width:${(topCorr.confidence || 0) * 100}%"></div>
                            </div>
                        ` : '<p style="color:var(--text-secondary);margin-top:var(--space-lg)">No correlated events found</p>'}
                    </div>

                    <div class="evidence-card">
                        <div class="card-header">
                            <h4>Cost History (24h)</h4>
                        </div>
                        <div class="chart-container" style="height:140px;position:relative;margin-top:12px">
                            <canvas id="detail-sparkline"></canvas>
                        </div>
                    </div>
                </div>

                ${correlations.length > 0 ? `
                <div class="section">
                    <h3 class="section-title">All Correlated Audit Events</h3>
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
                                        <td><span class="severity-badge" style="background:var(--info-surface);color:var(--info-content)">${corr.event_kind || ''} ${corr.event_action || ''}</span></td>
                                        <td style="font-family:var(--font-mono);font-size:var(--text-sm)">${corr.event_name || corr.event || ''}</td>
                                        <td>
                                            <div style="display:flex;align-items:center;gap:var(--space-sm)">
                                                <div class="confidence-bar" style="width:60px;margin:0"><div class="fill" style="width:${(corr.confidence || 0) * 100}%"></div></div>
                                                <span style="font-variant-numeric:tabular-nums">${Math.round((corr.confidence || 0) * 100)}%</span>
                                            </div>
                                        </td>
                                        <td style="font-variant-numeric:tabular-nums">${(corr.time_delta_seconds || 0) < 0 ? '' : '+'}${((corr.time_delta_seconds || 0) / 60).toFixed(0)} min</td>
                                        <td style="font-size:var(--text-sm);color:var(--text-secondary);max-width:300px">${corr.explanation || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        // Action buttons
        document.getElementById('btn-ack')?.addEventListener('click', async () => {
            await api.updateIncident(incident.id, { status: 'acknowledged' });
            renderIncidentDetail(container, params);
        });
        document.getElementById('btn-resolve')?.addEventListener('click', async () => {
            await api.updateIncident(incident.id, { status: 'resolved' });
            renderIncidentDetail(container, params);
        });

        // Render sparkline from cost_history
        setTimeout(async () => {
            const ctx = document.getElementById('detail-sparkline');
            if (ctx) {
                let historyData = costHistory;
                if (historyData.length === 0 && workload.namespace && workload.controller) {
                    try {
                        const resp = await api.getCostHistory(workload.namespace, workload.controller, 24);
                        historyData = (resp.data || []).map(d => d.value);
                    } catch(e) { historyData = []; }
                } else {
                    historyData = historyData.map(h => typeof h === 'object' ? h.value : h);
                }

                if (historyData.length > 0) {
                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: historyData.map((_, i) => `${historyData.length - i}h ago`),
                            datasets: [{
                                data: historyData,
                                borderColor: incident.severity === 'critical' ? '#E03E2F' : '#F5A623',
                                backgroundColor: incident.severity === 'critical' ? 'rgba(224, 62, 47, 0.12)' : 'rgba(245, 166, 35, 0.12)',
                                fill: true, tension: 0.3, borderWidth: 1.5, pointRadius: 0,
                                pointHoverRadius: 4, pointHoverBackgroundColor: '#fff'
                            }]
                        },
                        options: {
                            responsive: true, maintainAspectRatio: false,
                            plugins: { legend: { display: false }, tooltip: {
                                backgroundColor: '#272233', titleColor: '#FFFFFF', bodyColor: '#A39BB0',
                                borderColor: '#3D374A', borderWidth: 1, padding: 10, cornerRadius: 4,
                                callbacks: { label: (ctx) => `$${ctx.parsed.y.toFixed(2)}/hr` }
                            }},
                            scales: {
                                x: { display: false },
                                y: { grid: { color: '#2D2838' }, ticks: { color: '#6D657A', font: { size: 10 }, callback: v => '$' + v } }
                            }
                        }
                    });
                }
            }
            if (window.lucide) window.lucide.createIcons();
        }, 100);
    } catch (err) {
        container.innerHTML = `<div class="page"><div class="empty-state"><h3>Failed to load incident</h3><p>${err.message}</p></div></div>`;
    }
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}
