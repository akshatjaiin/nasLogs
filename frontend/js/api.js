// API client - talks to Django backend
const API_BASE = 'http://localhost:8000/api';

async function fetchJSON(url) {
    const response = await fetch(url);
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
        const qs = query.toString();
        return fetchJSON(`${API_BASE}/incidents/${qs ? '?' + qs : ''}`);
    },

    async getIncident(id) {
        return fetchJSON(`${API_BASE}/incidents/${id}/`);
    },

    async updateIncident(id, data) {
        const response = await fetch(`${API_BASE}/incidents/${id}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.json();
    },

    // Costs
    async getCostBreakdown() {
        return fetchJSON(`${API_BASE}/costs/breakdown/`);
    },

    async getCostHistory(namespace, controller, hours = 24) {
        return fetchJSON(`${API_BASE}/costs/history/?namespace=${namespace}&controller=${controller}&hours=${hours}`);
    },
};
