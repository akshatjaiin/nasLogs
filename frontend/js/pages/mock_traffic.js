export function renderMockTraffic(container) {
    container.innerHTML = `
        <div class="page">
            <div class="page-header" style="display:flex;align-items:center;justify-content:space-between">
                <div>
                    <h1 class="page-title">Network Flow & Egress Cardinality</h1>
                    <p class="page-subtitle">Inspect high-cardinality egress metrics, destination IPs, and cross-AZ traffic</p>
                </div>
                <span class="severity-badge warning" style="font-size:var(--text-xs)">🚧 MOCK — Under Active Development</span>
            </div>

            <div class="grid-3" style="margin-bottom:var(--space-xl)">
                <div class="score-card">
                    <div class="card-label">Total Egress Volume (24h)</div>
                    <div class="card-value">1.42 TB</div>
                    <div class="card-trend up">↑ +18% vs yesterday</div>
                </div>
                <div class="score-card">
                    <div class="card-label">Cross-AZ Egress</div>
                    <div class="card-value">$89.10</div>
                    <div class="card-trend up">Inter-subnet traffic</div>
                </div>
                <div class="score-card">
                    <div class="card-label">Internet / NAT Egress</div>
                    <div class="card-value">$198.40</div>
                    <div class="card-trend up">$0.045/GB NAT charge</div>
                </div>
            </div>

            <div class="panel" style="margin-bottom:var(--space-xl)">
                <div class="panel-header">
                    <h3 class="panel-title">🌐 Top Destination Services & Egress Cost</h3>
                </div>
                <table class="correlations-table">
                    <thead>
                        <tr>
                            <th>Destination Category</th>
                            <th>Target Endpoint / Subnet</th>
                            <th>Total Bytes (24h)</th>
                            <th>Est. Cost</th>
                            <th>Top Workload Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><span class="severity-badge open">AWS S3 (Internet)</span></td>
                            <td style="font-family:var(--font-mono)">s3.us-east-1.amazonaws.com</td>
                            <td>842.1 GB</td>
                            <td style="font-weight:700;color:var(--critical-content)">$75.78</td>
                            <td>media/image-worker</td>
                        </tr>
                        <tr>
                            <td><span class="severity-badge warning">Cross-AZ Egress</span></td>
                            <td style="font-family:var(--font-mono)">subnet-us-east-1b (AZ-2)</td>
                            <td>410.5 GB</td>
                            <td style="font-weight:700;color:var(--warning-content)">$41.05</td>
                            <td>ecommerce/cart-service</td>
                        </tr>
                        <tr>
                            <td><span class="severity-badge" style="background:var(--info-surface);color:var(--info-content)">AWS DynamoDB</span></td>
                            <td style="font-family:var(--font-mono)">dynamodb.us-east-1.amazonaws.com</td>
                            <td>112.0 GB</td>
                            <td style="font-weight:700">$10.08</td>
                            <td>payments/payment-api</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `;
}
