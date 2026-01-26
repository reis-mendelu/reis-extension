export function getDayOfWeek(dateStr: string): string {
    const [d, m, y] = dateStr.split('.').map(Number);
    return ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'][new Date(y, m - 1, d).getDay()];
}

export function parseRegistrationStart(str: string): Date | null {
    try {
        const [d, t] = str.split(' '), [day, month, year] = d.split('.').map(Number), [h, m] = (t || '00:00').split(':').map(Number);
        return new Date(year, month - 1, day, h, m);
    } catch { return null; }
}

export function formatCountdown(ms: number): string {
    if (ms <= 0) return 'Nyní';
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
}
