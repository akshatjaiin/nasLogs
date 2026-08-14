import { api } from '../api.js';

export async function renderTraffic(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:500px;margin:24px"></div></div>`;

    try {
        const traffic = await api.getTrafficFlows();

        container.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">Traffic Flows & Destination Egress</h1>
                    <p class="page-subtitle">High-cardinality IP egress breakdown, NAT Gateway charges, and cross-AZ telemetry</p>
                </div>

                <div class="grid-4">
                    <div class="score-card">
                        <div class="card-label">Total Egress Volume</div>
                        <div class="card-value">${traffic.total_egress_gb || 0} GB</div>
                        <div class="card-trend up">Last 24 hours</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">NAT Gateway Charges</div>
                        <div class="card-value" style="color:var(--critical-content)">$${(traffic.nat_gateway_estimated_cost || 0).toFixed(2)}</div>
                        <div class="card-trend up">@ $0.045/GB AWS rate</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">Cross-AZ Egress</div>
                        <div class="card-value">$${(traffic.cross_zone_cost || 0).toFixed(2)}</div>
                        <div class="card-trend flat">Inter-zone traffic</div>
                    </div>
                    <div class="score-card">
                        <div class="card-label">Internet Egress</div>
                        <div class="card-value">$${(traffic.internet_cost || 0).toFixed(2)}</div>
                        <div class="card-trend up">Out-of-cluster traffic</div>
                    </div>
                </div>

                <div class="panel">
                    <h3 class="section-title">Top Egress Workloads</h3>
                    <div class="table-container">
                        <table class="correlations-table">
                            <thead>
                                <tr>
                                    <th>Namespace</th>
                                    <th>Controller</th>
                                    <th>Bytes Transferred</th>
                                    <th>Est. Hourly Cost</th>
                                    <th>Egress Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${(traffic.top_destinations || []).map(dest => `
                                    <tr>
                                        <td><span class="severity-badge" style="background:var(--bg-tertiary)">${dest.namespace || 'unknown'}</span></td>
                                        <td style="font-family:var(--font-mono);font-size:var(--text-sm)">${dest.controller || 'unknown'}</td>
                                        <td style="font-variant-numeric:tabular-nums">${dest.bytes_transferred || '0 GB'}</td>
                                        <td style="font-variant-numeric:tabular-nums;font-weight:700">$${(dest.cost || 0).toFixed(2)}</td>
                                        <td>
                                            <span class="severity-badge ${(dest.traffic_type || '').includes('NAT') || (dest.traffic_type || '').includes('Internet') ? 'critical' : 'warning'}">
                                                ${dest.traffic_type || 'Unknown'}
                                            </span>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="page"><div class="empty-state"><h3>Failed to load traffic flows</h3><p>${err.message}</p></div></div>`;
    }
}
