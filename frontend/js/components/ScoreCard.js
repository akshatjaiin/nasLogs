/**
 * Reusable Metric Scorecard Component
 */
export function ScoreCard({ label, value, trendText, trendType = 'up', valueColor = null }) {
    const styleAttr = valueColor ? `style="color:${valueColor}"` : '';
    return `
        <div class="score-card">
            <div class="card-label">${label}</div>
            <div class="card-value" ${styleAttr}>${value}</div>
            <div class="card-trend ${trendType}">${trendText}</div>
        </div>
    `;
}
