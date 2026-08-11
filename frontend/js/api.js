// API client - talks to Django backend
const API_BASE = 'http://localhost:8000/api';

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
}

export const api = {
    // Dashboard
    async getDashboardSummary() {
        return fetchJSON(`${API_BASE}/dashboard/summary/`);
    },

    // Incidents
    async getIncidents(params = {}) {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.severity) query.set('severity', params.severity);
        if (params.search) query.set('search', params.search);
        if (params.start_time) query.set('start_time', params.start_time);
        if (params.end_time) query.set('end_time', params.end_time);
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

    // Costs
    async getCostBreakdown() {
        return fetchJSON(`${API_BASE}/costs/breakdown/`);
    },

    async getCostHistory(namespace, controller, hours = 24) {
        return fetchJSON(`${API_BASE}/costs/history/?namespace=${namespace}&controller=${controller}&hours=${hours}`);
    },

    // Multi-Project Management & Settings
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

    async testOpenCostConnection(url) {
        return fetchJSON(`${API_BASE}/projects/test-connection/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
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

    // Alert Rules
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
        const response = await fetch(`${API_BASE}/alerts/rules/${id}/`, { method: 'DELETE' });
        return response.ok;
    },

    async testAlertRule(id) {
        return fetchJSON(`${API_BASE}/alerts/rules/${id}/test/`, { method: 'POST' });
    },

    // Traffic Flows
    async getTrafficFlows() {
        return fetchJSON(`${API_BASE}/traffic/flows/`);
    }
};
