export function parseDeadline(s: string): Date | null {
    const [datePart, timePart] = s.split(' ');
    if (!datePart || !timePart) return null;
    const [d, m, y] = datePart.split('.').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    if ([d, m, y, h, min].some(Number.isNaN)) return null;
    return new Date(y, m - 1, d, h, min);
}

export function getDeadlineUrgency(deadline?: string): 'none' | 'warning' | 'critical' | 'expired' {
    if (!deadline) return 'none';
    const parsed = parseDeadline(deadline);
    if (!parsed) return 'none';
    const ms = parsed.getTime() - Date.now();
    if (ms < 0) return 'expired';
    if (ms < 86_400_000) return 'critical';
    if (ms < 172_800_000) return 'warning';
    return 'none';
}

export function formatDeadlineCountdown(deadline: string): string {
    const parsed = parseDeadline(deadline);
    if (!parsed) return '';
    const ms = parsed.getTime() - Date.now();
    if (ms < 0) return '';
    const h = Math.floor(ms / 3_600_000);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
}
