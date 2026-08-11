import { Router } from './router.js';
import { renderOverview } from './pages/overview.js';
import { renderIncidents } from './pages/incidents.js';
import { renderIncidentDetail } from './pages/incident-detail.js';
import { renderBreakdown } from './pages/breakdown.js';
import { renderDocs } from './pages/docs.js';

// Global active project state
window.currentProjectId = '1';

// Initialize Sentry-style sidebar with Organization & Project picker
function initSidebar(router) {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <div class="logo-icon">🔥</div>
            <div class="logo-text">
                Smoke Detector
                <span>Network Cost Incidents</span>
            </div>
        </div>

        <div class="project-selector-container">
            <div class="org-label">Acme Corp</div>
            <div class="project-dropdown-wrapper">
                <select id="project-picker" class="project-dropdown">
                    <option value="all">⚡ All Projects</option>
                    <option value="1" selected>📦 Production Cluster (AWS)</option>
                    <option value="2">🧪 Staging Cluster (EKS)</option>
                </select>
            </div>
        </div>

        <nav class="sidebar-nav">
            <a href="/" data-link class="nav-item active" data-route="/">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                Overview
            </a>
            <a href="/incidents" data-link class="nav-item" data-route="/incidents">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Cost Incidents
            </a>
            <a href="/breakdown" data-link class="nav-item" data-route="/breakdown">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
                Cost Breakdown
            </a>
            <a href="/docs" data-link class="nav-item" data-route="/docs">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                Setup & Agent Deploy
            </a>
        </nav>

        <div class="sidebar-footer">
            <span>v0.1.0 · AWS Ready</span>
            <span style="color:var(--success-content)">● Live</span>
        </div>
    `;

    // Handle project picker change
    document.getElementById('project-picker').addEventListener('change', (e) => {
        window.currentProjectId = e.target.value;
        router.resolve();
    });
}

// Router configuration with clean URLs
export const router = new Router([
    { path: '/', render: renderOverview },
    { path: '/incidents', render: renderIncidents },
    { path: '/incidents/:id', render: renderIncidentDetail },
    { path: '/breakdown', render: renderBreakdown },
    { path: '/docs', render: renderDocs },
]);

// Global navigation helper
window.navigateTo = (path) => router.navigate(path);

// Boot
initSidebar(router);
router.resolve();
