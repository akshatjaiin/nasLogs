/**
 * Centralized Chart.js Builder & Styling Utility
 */
export class ChartBuilder {
    static createAreaChart(canvasElement, labels, data, options = {}) {
        if (!canvasElement) return null;
        const ctx = canvasElement.getContext('2d');
        
        const strokeColor = options.strokeColor || '#7553FF';
        const gradient = ctx.createLinearGradient(0, 0, 0, options.height || 220);
        gradient.addColorStop(0, options.gradientStart || 'rgba(117, 83, 255, 0.35)');
        gradient.addColorStop(1, options.gradientEnd || 'rgba(117, 83, 255, 0.0)');

        return new Chart(canvasElement, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    borderColor: strokeColor,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#FFFFFF',
                    pointHoverBorderColor: strokeColor,
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#1E1929',
                        titleColor: '#FFFFFF',
                        bodyColor: '#B1A9C2',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 6,
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => options.tooltipFormat ? options.tooltipFormat(ctx.parsed.y) : `$${ctx.parsed.y.toFixed(2)}/hr`
                        }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#776E87', font: { size: 10 } } },
                    y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#776E87', font: { size: 10 }, callback: v => '$' + v } }
                }
            }
        });
    }

    static createSparkline(canvasElement, data, isCritical = true) {
        if (!canvasElement || !data || data.length === 0) return null;
        const color = isCritical ? '#FF3B30' : '#FFCC00';
        const bg = isCritical ? 'rgba(255, 59, 48, 0.1)' : 'rgba(255, 204, 0, 0.1)';

        return new Chart(canvasElement, {
            type: 'line',
            data: {
                labels: data.map((_, i) => i),
                datasets: [{
                    data: data,
                    borderColor: color,
                    backgroundColor: bg,
                    fill: true,
                    tension: 0.3,
                    borderWidth: 1.5,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    }
}
