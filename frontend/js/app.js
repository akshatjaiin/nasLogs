import { Router } from './router.js';
import { renderOverview } from './pages/overview.js';
import { renderIncidents } from './pages/incidents.js';
import { renderIncidentDetail } from './pages/incident-detail.js';
import { renderBreakdown } from './pages/breakdown.js';
import { renderDocs } from './pages/docs.js';
import { renderSettings } from './pages/settings.js';
import { renderAlerts } from './pages/alerts.js';
import { renderTraffic } from './pages/traffic.js';

// Global active project state
window.currentProjectId = '1';

// Countdown timer state
let pollSecondsRemaining = 15;

// Initialize Sentry-style Top Global Header Bar
function initTopHeader() {
    const header = document.getElementById('top-header');
    header.innerHTML = `
        <div class="top-header-left">
            <div class="global-search">
                <i data-lucide="search" style="width:14px;height:14px;color:var(--text-disabled)"></i>
                <input type="text" placeholder="Search incidents, workloads, or IP destinations..." id="global-search-input">
                <span class="shortcut-chip">Ctrl+K</span>
            </div>
        </div>

        <div class="top-header-right">
            <div style="display:flex;align-items:center;gap:6px;font-size:var(--text-xs);color:var(--text-secondary);background:var(--bg-secondary);padding:4px 10px;border-radius:var(--radius-md);border:1px solid var(--border-primary)">
                <span style="color:var(--success-content)" class="pulse-dot">●</span>
                <span>Live Ingestion</span>
                <span style="color:var(--border-muted)">|</span>
                <span id="poll-timer-badge" style="font-family:var(--font-mono);color:var(--text-heading)">Syncing in 15s</span>
            </div>

            <button class="btn btn-ghost" id="top-copy-dsn-btn" style="height:32px;font-size:var(--text-xs)">
                <i data-lucide="key" style="width:14px;height:14px"></i>
                Copy DSN
            </button>

            <a href="/docs" data-link class="btn btn-primary" style="height:32px;font-size:var(--text-xs)">
                <i data-lucide="download-cloud" style="width:14px;height:14px"></i>
                Deploy Agent
            </a>
        </div>
    `;

    // Copy DSN handler
    document.getElementById('top-copy-dsn-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText('http://nas_live_9f8a37b120c94e82b7@localhost:8000/api/collector/v1/ingest/1');
        const btn = document.getElementById('top-copy-dsn-btn');
        btn.innerHTML = `<i data-lucide="check" style="width:14px;height:14px"></i> DSN Copied!`;
        if (window.lucide) window.lucide.createIcons();
        setTimeout(() => {
            btn.innerHTML = `<i data-lucide="key" style="width:14px;height:14px"></i> Copy DSN`;
            if (window.lucide) window.lucide.createIcons();
        }, 2000);
    });
}

// Initialize Sentry-style sidebar with Organization & Project picker
function initSidebar(router) {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = `
        <div class="sidebar-logo">
            <div class="logo-icon" style="background:var(--accent);width:26px;height:26px;border-radius:4px;display:flex;align-items:center;justify-content:center">
                <i data-lucide="activity" style="width:16px;height:16px;color:#FFF"></i>
            </div>
            <div class="logo-text">
                NAS Logs
                <span>Sentry for Network Costs</span>
            </div>
        </div>

        <div class="project-selector-container">
            <div class="org-label">Acme Corp</div>
            <div class="project-dropdown-wrapper">
                <select id="project-picker" class="project-dropdown">
                    <option value="all">All Projects</option>
                    <option value="1" selected>Production Cluster (AWS)</option>
                    <option value="2">Staging Cluster (EKS)</option>
                </select>
            </div>
        </div>

        <nav class="sidebar-nav">
            <a href="/" data-link class="nav-item active" data-route="/">
                <i data-lucide="layout-dashboard" class="nav-icon"></i>
                Overview
            </a>
            <a href="/incidents" data-link class="nav-item" data-route="/incidents">
                <i data-lucide="alert-triangle" class="nav-icon"></i>
                Cost Incidents
            </a>
            <a href="/breakdown" data-link class="nav-item" data-route="/breakdown">
                <i data-lucide="bar-chart-3" class="nav-icon"></i>
                Cost Breakdown
            </a>
            <a href="/traffic" data-link class="nav-item" data-route="/traffic">
                <i data-lucide="network" class="nav-icon"></i>
                Traffic Flows
            </a>
            <a href="/alerts" data-link class="nav-item" data-route="/alerts">
                <i data-lucide="bell" class="nav-icon"></i>
                Alert Rules
            </a>
            <a href="/settings" data-link class="nav-item" data-route="/settings">
                <i data-lucide="settings" class="nav-icon"></i>
                Project Keys & DSN
            </a>
            <a href="/docs" data-link class="nav-item" data-route="/docs">
                <i data-lucide="book-open" class="nav-icon"></i>
                Setup & Agent Deploy
            </a>
        </nav>

        <div class="sidebar-footer">
            <span>NAS Logs v0.1.0</span>
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
    { path: '/traffic', render: renderTraffic },
    { path: '/alerts', render: renderAlerts },
    { path: '/settings', render: renderSettings },
    { path: '/docs', render: renderDocs },
]);

// Trigger Lucide icons on route change
window.addEventListener('popstate', () => {
    if (window.lucide) window.lucide.createIcons();
});

// Global navigation helper
window.navigateTo = (path) => {
    router.navigate(path);
    if (window.lucide) setTimeout(() => window.lucide.createIcons(), 50);
};

// Keyboard reactions (Ctrl+K to focus search, Esc to unselect/close)
window.addEventListener('keydown', (e) => {
    const searchInput = document.getElementById('global-search-input');
    
    // Ctrl+K or Cmd+K shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInput) searchInput.focus();
    }
    
    // Escape key shortcut
    if (e.key === 'Escape') {
        if (document.activeElement === searchInput) {
            searchInput.blur();
        }
        // Close any open modals/drawers
        document.querySelectorAll('#workload-history-drawer, #modal-create-rule').forEach(el => {
            el.style.display = 'none';
        });
    }
});

// Automatic Live Polling Loop (Every 15 Seconds)
setInterval(() => {
    pollSecondsRemaining--;
    const badge = document.getElementById('poll-timer-badge');
    if (badge) {
        if (pollSecondsRemaining <= 0) {
            badge.innerText = 'Syncing...';
            pollSecondsRemaining = 15;
            router.resolve();
            setTimeout(() => {
                const b = document.getElementById('poll-timer-badge');
                if (b) b.innerText = 'Syncing in 15s';
            }, 1000);
        } else {
            badge.innerText = `Syncing in ${pollSecondsRemaining}s`;
        }
    }
}, 1000);

// Boot
initTopHeader();
initSidebar(router);
router.resolve();
if (window.lucide) window.lucide.createIcons();
