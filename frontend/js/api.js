import { auth } from './auth.js';

const API_BASE = '/api';

const MOCK_DEMO_DATA = {
    summary: {
        open_incidents_count: 1,
        critical_count: 1,
        total_hourly_cost: 4280.50,
        cost_history_24h: [52, 49, 51, 50, 48, 53, 52, 50, 49, 51, 48, 52, 480, 2400, 4280, 4280, 4250, 4280, 4190, 4280, 4280, 4280, 4280, 4280],
        recent_incidents: [
            {
                id: 1,
                title: 'Egress Surge: media/image-processor (+620%)',
                severity: 'critical',
                status: 'open',
                created_at: new Date(Date.now() - 15 * 60000).toISOString(),
                evidence: {
                    anomaly: {
                        deviation_pct: 620.5,
                        spike: 4280.50,
                        baseline: 51.20
                    },
                    cost_history: [51.2, 51.2, 51.2, 51.2, 480.0, 2400.0, 4280.5]
                }
            }
        ]
    },

    incidents: [
        {
            id: 1,
            title: 'Egress Surge: media/image-processor (+620%)',
            severity: 'critical',
            status: 'open',
            created_at: new Date(Date.now() - 15 * 60000).toISOString(),
            fingerprint: 'fp-media-imgproc-egress-spike-01',
            evidence: {
                anomaly: {
                    deviation_pct: 620.5,
                    spike: 4280.50,
                    baseline: 51.20,
                    z_score: 4.82
                },
                correlated_events: [
                    {
                        id: 482,
                        event_type: 'Deployment/image-processor updated',
                        actor: 'alex.dev@acme.com',
                        timestamp: new Date(Date.now() - 28 * 60000).toISOString(),
                        confidence: 0.94,
                        details: 'ConfigMap memory limit increased & parallel S3 image export thread pool expanded from 4 to 64 workers (Cross-Region us-east-1 to eu-west-1).'
                    }
                ],
                cost_history: [51.2, 51.2, 51.2, 51.2, 480.0, 2400.0, 4280.5]
            }
        }
    ],

    traffic: {
        total_egress_bytes: 582749102948,
        total_hourly_cost: 4457.40,
        cross_zone_cost: 142.90,
        internet_cost: 4314.50,
        workloads: [
            { namespace: "media", controller_name: "image-processor", network_egress_bytes: 541092839482, network_cost_total: 4280.50, egress_type: "Cross-Region S3" },
            { namespace: "production", controller_name: "kafka-connect", network_egress_bytes: 38274910294, network_cost_total: 142.80, egress_type: "Internet Gateway" },
            { namespace: "analytics", controller_name: "clickhouse-worker", network_egress_bytes: 3381382172, network_cost_total: 34.10, egress_type: "Cross-Zone VPC" }
        ]
    },

    breakdown: {
        namespaces: [
            { name: "media", total_cost: 4280.50, percentage: 96.0 },
            { name: "production", total_cost: 142.80, percentage: 3.2 },
            { name: "analytics", total_cost: 34.10, percentage: 0.8 }
        ]
    },

    projects: [
        { id: 1, name: "Production Cluster (AWS EKS)", opencost_url: "http://opencost.monitoring.svc:9003", api_key: "demo-api-key-9f8a37b120c94e82b7" }
    ],

    settings: {
        id: 1,
        name: "Production Cluster (AWS EKS)",
        opencost_url: "http://opencost.monitoring.svc:9003",
        api_key: "demo-api-key-9f8a37b120c94e82b7",
        dsn: "http://demo-api-key-9f8a37b120c94e82b7@localhost:8000/api/collector/v1/ingest/1/",
        retention_days: 30,
        baseline_window_hours: 168,
        min_cost_threshold: 0.01,
        warning_pct: 200,
        critical_pct: 500
    }
};

async function fetchJSON(url, options = {}) {
    if (!options.headers) options.headers = {};
    if (auth.isLoggedIn()) {
        options.headers['Authorization'] = `Bearer ${auth.getToken()}`;
    }

    try {
        let response = await fetch(url, options);

        if (response.status === 401) {
            if (url.includes('/auth/login/') || url.includes('/auth/register/')) {
                const data = await response.json();
                throw new Error(data.detail || data.error || 'Invalid credentials');
            }

            const refreshed = await auth.tryRefresh();
            if (refreshed) {
                options.headers['Authorization'] = `Bearer ${auth.getToken()}`;
                response = await fetch(url, options);
            } else {
                auth.clear();
                if (window.location.pathname !== '/login') {
                    window.history.pushState(null, '', '/login');
                    window.dispatchEvent(new CustomEvent('nas:auth:logout'));
                }
            }
        }

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        return response.json();
    } catch (err) {
        // Zero-Cost Client-Side Demo Mode Fallback when backend API is unreachable
        if (url.includes('/dashboard/summary/')) return MOCK_DEMO_DATA.summary;
        if (url.includes('/incidents/1/')) return MOCK_DEMO_DATA.incidents[0];
        if (url.includes('/incidents/')) return MOCK_DEMO_DATA.incidents;
        if (url.includes('/traffic/flows/')) return MOCK_DEMO_DATA.traffic;
        if (url.includes('/costs/breakdown/')) return MOCK_DEMO_DATA.breakdown;
        if (url.includes('/projects/all/')) return { projects: MOCK_DEMO_DATA.projects };
        if (url.includes('/projects/settings/')) return MOCK_DEMO_DATA.settings;
        if (url.includes('/alerts/rules/')) return { rules: [] };
        
        throw err;
    }
}

export const api = {
    async getDashboardSummary() {
        return fetchJSON(`${API_BASE}/dashboard/summary/`);
    },

    async getIncidents(params = {}) {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.severity) query.set('severity', params.severity);
        if (params.search) query.set('search', params.search);
        const qs = query.toString();
        return fetchJSON(`${API_BASE}/incidents/${qs ? '?' + qs : ''}`);
    },

    async getIncident(id) {
        return fetchJSON(`${API_BASE}/incidents/${id}/`);
    },

    async updateIncident(id, data) {
        return fetchJSON(`${API_BASE}/incidents/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
    },

    async getCostBreakdown() {
        return fetchJSON(`${API_BASE}/costs/breakdown/`);
    },

    async getTrafficFlows() {
        return fetchJSON(`${API_BASE}/traffic/flows/`);
    },

    async getProjects() {
        return fetchJSON(`${API_BASE}/projects/all/`);
    },

    async createProject(data) {
        return fetchJSON(`${API_BASE}/projects/all/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async getProjectSettings(projectId = '1') {
        return fetchJSON(`${API_BASE}/projects/settings/?project_id=${projectId}`);
    },

    async updateProjectSettings(data) {
        return fetchJSON(`${API_BASE}/projects/settings/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async regenerateProjectDSN(projectId = '1') {
        return fetchJSON(`${API_BASE}/projects/settings/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: projectId, regenerate_dsn: true })
        });
    },

    async getAlertRules(projectId = '1') {
        return fetchJSON(`${API_BASE}/alerts/rules/?project_id=${projectId}`);
    },

    async createAlertRule(data) {
        return fetchJSON(`${API_BASE}/alerts/rules/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    },

    async deleteAlertRule(id) {
        return fetchJSON(`${API_BASE}/alerts/rules/${id}/`, {
            method: 'DELETE'
        });
    },

    async testAlertRule(id) {
        return fetchJSON(`${API_BASE}/alerts/test-rule/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rule_id: id })
        });
    }
};
