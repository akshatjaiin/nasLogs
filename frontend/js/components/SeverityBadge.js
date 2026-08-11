/**
 * Reusable Severity Badge & Dot Component
 */
export function SeverityBadge(statusOrSeverity, label = null) {
    const text = label || statusOrSeverity;
    const lower = String(statusOrSeverity).toLowerCase();
    
    let badgeClass = 'warning';
    if (lower === 'critical' || lower === 'open') badgeClass = 'critical';
    else if (lower === 'acknowledged') badgeClass = 'warning';
    else if (lower === 'resolved') badgeClass = 'resolved';
    
    return `<span class="severity-badge ${badgeClass}">${text}</span>`;
}

export function SeverityDot(severity) {
    const lower = String(severity).toLowerCase();
    return `<div class="severity-dot ${lower}"></div>`;
}
