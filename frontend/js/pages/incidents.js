import { mockIncidents } from '../mock-data.js';

export function renderIncidents(container) {
    let filter = 'all';

    function render() {
        const filtered = filter === 'all' ? mockIncidents : 
            mockIncidents.filter(i => filter === 'open' ? i.status !== 'resolved' : i.status === filter);

        const critCount = mockIncidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
        const warnCount = mockIncidents.filter(i => i.severity === 'warning' && i.status !== 'resolved').length;
        const resCount = mockIncidents.filter(i => i.status === 'resolved').length;

        container.innerHTML = `
            <div class="page">
                <div class="page-header">
                    <h1 class="page-title">Cost Incidents</h1>
                    <p class="page-subtitle">Something changed. Find what caused the spike.</p>
                </div>

                <div class="toolbar">
                    <div class="toolbar-left">
                        <div class="filter-bar">
                            <button class="filter-pill ${filter === 'all' ? 'active' : ''}" data-filter="all">
                                All <span class="pill-count">${mockIncidents.length}</span>
                            </button>
                            <button class="filter-pill ${filter === 'open' ? 'active' : ''}" data-filter="open">
                                <span class="severity-dot critical" style="width:6px;height:6px"></span>
                                Critical <span class="pill-count">${critCount}</span>
                            </button>
                            <button class="filter-pill ${filter === 'warning' ? 'active' : ''}" data-filter="warning">
                                <span class="severity-dot warning" style="width:6px;height:6px"></span>
                                Warning <span class="pill-count">${warnCount}</span>
                            </button>
                            <button class="filter-pill ${filter === 'resolved' ? 'active' : ''}" data-filter="resolved">
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
                        <select class="time-select">
                            <option>Last 24 hours</option>
                            <option>Last 7 days</option>
                            <option>Last 30 days</option>
                        </select>
                    </div>
                </div>

                <div class="incident-list">
                    ${filtered.map(inc => `
                        <div class="incident-row" onclick="window.location.hash='/incidents/${inc.id}'">
                            <div class="severity-dot ${inc.severity}"></div>
                            <div class="incident-info">
                                <div class="incident-title">${inc.title} <span style="color: ${inc.severity === 'critical' ? 'var(--critical-content)' : 'var(--warning-content)'}">(+${inc.deviation_pct}%)</span></div>
                                <div class="incident-meta">
                                    <span class="severity-badge ${inc.status}">${inc.status}</span>
                                    <span class="meta-sep">·</span>
                                    <span>${inc.first_seen}</span>
                                    <span class="meta-sep">·</span>
                                    <span>${inc.evidence.workload.controller_kind}</span>
                                    <span class="meta-sep">·</span>
                                    <span style="color:var(--text-heading)">Impact: ${inc.cost_impact}</span>
                                </div>
                            </div>
                            <div class="sparkline-container"><canvas id="spark-list-${inc.id}" height="36"></canvas></div>
                            <div class="incident-cost">
                                <div class="cost-current">$${inc.spike_value.toFixed(2)}/hr</div>
                                <div class="cost-change spike">was $${inc.baseline_value.toFixed(2)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Filter click handlers
        container.querySelectorAll('.filter-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                filter = pill.dataset.filter;
                render();
            });
        });

        // Search
        const searchInput = container.querySelector('#incident-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase();
                container.querySelectorAll('.incident-row').forEach(row => {
                    const text = row.textContent.toLowerCase();
                    row.style.display = text.includes(q) ? '' : 'none';
                });
            });
        }

        // Sparklines
        setTimeout(() => {
            filtered.forEach(inc => {
                const ctx = document.getElementById(`spark-list-${inc.id}`);
                if (ctx) {
                    new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: inc.sparkline_data.map((_, i) => i),
                            datasets: [{
                                data: inc.sparkline_data,
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
    }

    render();
}
