import { Router } from './router.js';
import { renderOverview } from './pages/overview.js';
import { renderIncidents } from './pages/incidents.js';
import { renderIncidentDetail } from './pages/incident-detail.js';
import { renderBreakdown } from './pages/breakdown.js';

// Initialize sidebar
function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <div class="logo-icon">🔥</div>
            <div class="logo-text">
                Smoke Detector
                <span>Network Cost Incidents</span>
            </div>
        </div>
        <nav class="sidebar-nav">
            <div class="nav-item active" data-route="/" onclick="window.location.hash='/'">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                Overview
            </div>
            <div class="nav-item" data-route="/incidents" onclick="window.location.hash='/incidents'">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Cost Incidents
            </div>
            <div class="nav-item" data-route="/breakdown" onclick="window.location.hash='/breakdown'">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                Cost Breakdown
            </div>
            <div class="nav-item" data-route="/alerts" onclick="window.location.hash='/alerts'">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                Alerts
            </div>
        </nav>
        <div class="sidebar-footer">
            v0.1.0 · MVP
        </div>
    `;
}

// Initialize router
const router = new Router([
    { path: '/', render: renderOverview },
    { path: '/incidents', render: renderIncidents },
    { path: '/incidents/:id', render: renderIncidentDetail },
    { path: '/breakdown', render: renderBreakdown },
]);

// Boot
initSidebar();
router.resolve();
