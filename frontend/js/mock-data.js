// mock-data.js — Realistic demo data for the Smoke Detector dashboard

export const mockIncidents = [
    {
        id: 1,
        title: 'Cost Spike: ecommerce/cart-service',
        namespace: 'ecommerce',
        controller: 'cart-service',
        severity: 'critical',
        status: 'open',
        metric: 'network_cost_total',
        baseline_value: 1.20,
        spike_value: 8.40,
        deviation_pct: 600,
        created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        first_seen: '2h ago',
        cost_impact: '$43.20',
        evidence: {
            anomaly: { metric: 'network_cost_total', baseline: 1.20, spike: 8.40, deviation_pct: 600, method: 'pct_change' },
            workload: { namespace: 'ecommerce', controller_kind: 'deployment', controller_name: 'cart-service' },
            correlations: [
                { event_kind: 'deployment', event_name: 'cart-service', event_action: 'update', confidence: 0.92, time_delta_seconds: -300, explanation: 'Deployment updated (cart:v2.0 → cart:v2.1) 5 minutes before spike', details: { image: 'cart:v2.1' } },
                { event_kind: 'configmap', event_name: 'cart-config', event_action: 'update', confidence: 0.67, time_delta_seconds: -1200, explanation: 'ConfigMap updated 20 minutes before spike', details: {} },
                { event_kind: 'hpa', event_name: 'cart-hpa', event_action: 'scale', confidence: 0.45, time_delta_seconds: 300, explanation: 'HPA scaled up 5 minutes after spike (likely reaction)', details: { replicas: '3→8' } }
            ]
        },
        sparkline_data: [1.2,1.1,1.3,1.2,1.1,1.2,1.3,1.2,1.1,1.2,1.3,1.4,1.2,1.1,8.4,8.2,7.9,8.1,7.5,6.8,5.2,4.1,3.5,3.0]
    },
    {
        id: 2,
        title: 'Cost Spike: media/image-worker',
        namespace: 'media',
        controller: 'image-worker',
        severity: 'warning',
        status: 'open',
        metric: 'network_cost_total',
        baseline_value: 80.00,
        spike_value: 248.00,
        deviation_pct: 210,
        created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
        first_seen: '4h ago',
        cost_impact: '$672.00',
        evidence: {
            anomaly: { metric: 'network_cost_total', baseline: 80.00, spike: 248.00, deviation_pct: 210, method: 'pct_change' },
            workload: { namespace: 'media', controller_kind: 'deployment', controller_name: 'image-worker' },
            correlations: [
                { event_kind: 'deployment', event_name: 'image-worker', event_action: 'update', confidence: 0.88, time_delta_seconds: -600, explanation: 'Deployment updated 10 minutes before spike', details: { image: 'img-proc:v3.4' } }
            ]
        },
        sparkline_data: [80,82,79,81,80,78,82,80,81,79,80,82,248,240,235,220,200,190,180,170,160,150,140,130]
    },
    {
        id: 3,
        title: 'Cost Spike: payments/payment-api',
        namespace: 'payments',
        controller: 'payment-api',
        severity: 'critical',
        status: 'open',
        metric: 'network_cost_total',
        baseline_value: 0.50,
        spike_value: 4.00,
        deviation_pct: 700,
        created_at: new Date(Date.now() - 1 * 3600000).toISOString(),
        first_seen: '1h ago',
        cost_impact: '$10.50',
        evidence: {
            anomaly: { metric: 'network_cost_total', baseline: 0.50, spike: 4.00, deviation_pct: 700, method: 'pct_change' },
            workload: { namespace: 'payments', controller_kind: 'deployment', controller_name: 'payment-api' },
            correlations: []
        },
        sparkline_data: [0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,0.5,4.0,3.8,3.5,3.2]
    },
    {
        id: 4,
        title: 'Cost Spike: monitoring/prometheus',
        namespace: 'monitoring',
        controller: 'prometheus',
        severity: 'warning',
        status: 'acknowledged',
        metric: 'network_cross_zone_cost',
        baseline_value: 5.20,
        spike_value: 18.70,
        deviation_pct: 260,
        created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
        first_seen: '6h ago',
        cost_impact: '$81.00',
        evidence: {
            anomaly: { metric: 'network_cross_zone_cost', baseline: 5.20, spike: 18.70, deviation_pct: 260, method: 'zscore' },
            workload: { namespace: 'monitoring', controller_kind: 'statefulset', controller_name: 'prometheus' },
            correlations: [
                { event_kind: 'statefulset', event_name: 'prometheus', event_action: 'update', confidence: 0.78, time_delta_seconds: -900, explanation: 'StatefulSet updated 15 minutes before spike', details: {} }
            ]
        },
        sparkline_data: [5.2,5.0,5.3,5.1,5.2,5.4,5.1,5.3,18.7,17.5,16.2,15.8,14.5,13.0,12.5,11.8,10.5,9.8,9.2,8.5,7.8,7.2,6.5,6.0]
    },
    {
        id: 5,
        title: 'Cost Spike: batch/data-pipeline',
        namespace: 'batch',
        controller: 'data-pipeline',
        severity: 'warning',
        status: 'resolved',
        metric: 'network_internet_cost',
        baseline_value: 0.00,
        spike_value: 12.50,
        deviation_pct: 999,
        created_at: new Date(Date.now() - 12 * 3600000).toISOString(),
        first_seen: '12h ago',
        cost_impact: '$150.00',
        evidence: {
            anomaly: { metric: 'network_internet_cost', baseline: 0.00, spike: 12.50, deviation_pct: 999, method: 'pct_change' },
            workload: { namespace: 'batch', controller_kind: 'deployment', controller_name: 'data-pipeline' },
            correlations: [
                { event_kind: 'configmap', event_name: 'pipeline-config', event_action: 'update', confidence: 0.95, time_delta_seconds: -120, explanation: 'ConfigMap updated 2 minutes before spike — changed output endpoint to external S3 bucket', details: { key: 'OUTPUT_ENDPOINT' } }
            ]
        },
        sparkline_data: [0,0,0,0,0,0,0,0,0,0,0,0,12.5,12.0,11.5,11.0,10.0,8.5,6.0,3.0,1.0,0,0,0]
    },
    {
        id: 6,
        title: 'Cost Spike: logging/fluentd',
        namespace: 'logging',
        controller: 'fluentd',
        severity: 'critical',
        status: 'resolved',
        metric: 'network_cost_total',
        baseline_value: 15.00,
        spike_value: 89.00,
        deviation_pct: 493,
        created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
        first_seen: '1d ago',
        cost_impact: '$1,776.00',
        evidence: {
            anomaly: { metric: 'network_cost_total', baseline: 15.00, spike: 89.00, deviation_pct: 493, method: 'pct_change' },
            workload: { namespace: 'logging', controller_kind: 'daemonset', controller_name: 'fluentd' },
            correlations: [
                { event_kind: 'deployment', event_name: 'log-aggregator', event_action: 'update', confidence: 0.81, time_delta_seconds: -480, explanation: 'Log aggregator deployment updated 8 minutes before spike', details: {} }
            ]
        },
        sparkline_data: [15,14,15,16,15,14,15,15,14,15,89,85,78,70,62,55,48,42,36,30,25,20,18,16]
    }
];

export const mockBreakdown = [
    {
        namespace: 'ecommerce',
        total_cost: 12.40,
        delta_pct: 340,
        controllers: [
            { name: 'cart-service', cost: 8.40, delta_pct: 600, kind: 'deployment' },
            { name: 'checkout-api', cost: 2.10, delta_pct: 10, kind: 'deployment' },
            { name: 'catalog-svc', cost: 1.90, delta_pct: 5, kind: 'deployment' }
        ]
    },
    {
        namespace: 'media',
        total_cost: 248.00,
        delta_pct: 210,
        controllers: [
            { name: 'image-worker', cost: 248.00, delta_pct: 210, kind: 'deployment' },
            { name: 'video-proc', cost: 12.30, delta_pct: 8, kind: 'deployment' }
        ]
    },
    {
        namespace: 'payments',
        total_cost: 4.00,
        delta_pct: 700,
        controllers: [
            { name: 'payment-api', cost: 4.00, delta_pct: 700, kind: 'deployment' }
        ]
    },
    {
        namespace: 'monitoring',
        total_cost: 23.90,
        delta_pct: 45,
        controllers: [
            { name: 'prometheus', cost: 18.70, delta_pct: 260, kind: 'statefulset' },
            { name: 'grafana', cost: 3.20, delta_pct: 2, kind: 'deployment' },
            { name: 'alertmanager', cost: 2.00, delta_pct: 0, kind: 'deployment' }
        ]
    },
    {
        namespace: 'logging',
        total_cost: 18.00,
        delta_pct: -15,
        controllers: [
            { name: 'fluentd', cost: 16.00, delta_pct: -20, kind: 'daemonset' },
            { name: 'elasticsearch', cost: 2.00, delta_pct: 5, kind: 'statefulset' }
        ]
    },
    {
        namespace: 'batch',
        total_cost: 0.50,
        delta_pct: 0,
        controllers: [
            { name: 'data-pipeline', cost: 0.50, delta_pct: 0, kind: 'deployment' }
        ]
    }
];

export const mockSummary = {
    open_incidents: 4,
    critical_count: 2,
    total_hourly_cost: 306.80,
    cost_trend_pct: 23,
    cost_history_24h: [
        105, 102, 108, 104, 106, 103, 107, 105, 108, 110, 112, 115,
        306, 295, 280, 265, 248, 235, 220, 210, 200, 190, 185, 180
    ]
};
