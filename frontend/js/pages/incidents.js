import { api } from '../api.js';

export async function renderIncidents(container) {
    container.innerHTML = `<div class="page"><div class="loading-skeleton" style="height:600px;margin:24px"></div></div>`;
    
    let currentFilter = {};
    
    async function render() {
        try {
            const data = await api.getIncidents(currentFilter);
            const incidents = data.results || [];
            
            // Get counts for filter pills
            const allData = await api.getIncidents({});
            const allIncidents = allData.results || [];
            const critCount = allIncidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
            const warnCount = allIncidents.filter(i => i.severity === 'warning' && i.status !== 'resolved').length;
            const openCount = allIncidents.filter(i => i.status === 'open').length;
            const resCount = allIncidents.filter(i => i.status === 'resolved').length;
            
            container.innerHTML = `
                <div class="page">
                    <div class="page-header">
                        <h1 class="page-title">Cost Incidents</h1>
                        <p class="page-subtitle">Something changed. Find what caused the spike.</p>
                    </div>

                    <div class="toolbar">
                        <div class="toolbar-left">
                            <div class="filter-bar">
                                <button class="filter-pill ${!currentFilter.status && !currentFilter.severity ? 'active' : ''}" data-filter="all">
                                    All <span class="pill-count">${allIncidents.length}</span>
                                </button>
                                <button class="filter-pill ${currentFilter.status === 'open' ? 'active' : ''}" data-filter="open">
                                    <span class="severity-dot critical" style="width:6px;height:6px"></span>
                                    Open <span class="pill-count">${openCount}</span>
                                </button>
                                <button class="filter-pill ${currentFilter.severity === 'critical' ? 'active' : ''}" data-filter="critical">
                                    Critical <span class="pill-count">${critCount}</span>
                                </button>
                                <button class="filter-pill ${currentFilter.severity === 'warning' ? 'active' : ''}" data-filter="warning">
                                    Warning <span class="pill-count">${warnCount}</span>
                                </button>
                                <button class="filter-pill ${currentFilter.status === 'resolved' ? 'active' : ''}" data-filter="resolved">
                                    <span class="severity-dot resolved" style="width:6px;height:6px"></span>
                                    Resolved <span class="pill-count">${resCount}</span>
                                </button>
                            </div>
                        </div>
                        <div class="toolbar-right">
                            <div class="search-input">
                                <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" placeholder="Search incidents..." id="incident-search">
                            </div>
                        </div>
                    </div>

                    <div class="incident-list">
                        ${incidents.length > 0 ? incidents.map(inc => {
                            const ev = inc.evidence || {};
                            const anomaly = ev.anomaly || {};
                            const pct = Math.round(anomaly.deviation_pct || 0);
                            const spike = anomaly.spike || 0;
                            const baseline = anomaly.baseline || 0;
                            const costHistory = ev.cost_history || [];
                            return `
                                <div class="incident-row" onclick="window.location.hash='/incidents/${inc.id}'">
                                    <div class="severity-dot ${inc.severity}"></div>
                                    <div class="incident-info">
                                        <div class="incident-title">${inc.title} <span style="color: ${inc.severity === 'critical' ? 'var(--critical-content)' : 'var(--warning-content)'}">
                                            (+${pct}%)
                                        </span></div>
                                        <div class="incident-meta">
                                            <span class="severity-badge ${inc.status}">${inc.status}</span>
                                            <span class="meta-sep">·</span>
                                            <span>${timeAgo(inc.created_at)}</span>
                                            <span class="meta-sep">·</span>
                                            <span style="color:var(--text-heading)">$${(spike * 24).toFixed(0)} est. daily impact</span>
                                        </div>
                                    </div>
                                    <div class="sparkline-container"><canvas id="spark-${inc.id}" height="36"></canvas></div>
                                    <div class="incident-cost">
                                        <div class="cost-current">$${spike.toFixed(2)}/hr</div>
                                        <div class="cost-change spike">was $${baseline.toFixed(2)}</div>
                                    </div>
                                </div>
                            `;
                        }).join('') : '<div class="empty-state"><div class="empty-icon">🔍</div><h3>No incidents match your filters</h3></div>'}
                    </div>
                </div>
            `;

            // Filter handlers
            container.querySelectorAll('.filter-pill').forEach(pill => {
                pill.addEventListener('click', () => {
                    const f = pill.dataset.filter;
                    if (f === 'all') currentFilter = {};
                    else if (f === 'open') currentFilter = { status: 'open' };
                    else if (f === 'resolved') currentFilter = { status: 'resolved' };
                    else if (f === 'critical') currentFilter = { severity: 'critical' };
                    else if (f === 'warning') currentFilter = { severity: 'warning' };
                    render();
                });
            });

            // Search handler
            const searchInput = container.querySelector('#incident-search');
            let searchTimeout;
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        currentFilter.search = e.target.value || undefined;
                        render();
                    }, 300);
                });
            }

            // Sparklines from real cost_history data
            setTimeout(() => {
                incidents.forEach(inc => {
                    const ctx = document.getElementById(`spark-${inc.id}`);
                    const history = (inc.evidence || {}).cost_history || [];
                    if (ctx && history.length > 0) {
                        const values = history.map(h => typeof h === 'object' ? h.value : h);
                        new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: values.map((_, i) => i),
                                datasets: [{
                                    data: values,
                                    borderColor: inc.severity === 'critical' ? '#FF002B' : '#FFCE00',
                                    backgroundColor: inc.severity === 'critical' ? 'rgba(255,0,43,0.08)' : 'rgba(255,206,0,0.08)',
                                    fill: true, tension: 0.3, borderWidth: 1.5, pointRadius: 0
                                }]
                            },
                            options: {
                                responsive: true, maintainAspectRatio: false,
                                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                                scales: { x: { display: false }, y: { display: false } },
                                animation: { duration: 600, easing: 'easeOutQuart' }
                            }
                        });
                    }
                });
            }, 50);
        } catch (err) {
            container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">❌</div><h3>Backend Unavailable</h3><p>${err.message}</p></div></div>`;
        }
    }

    await render();
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
