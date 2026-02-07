/**
 * Get day of week abbreviation from date string (DD.MM.YYYY).
 */
export function getDayOfWeek(dateString: string, t: (k: string) => string): string {
    const [day, month, year] = dateString.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return t(`days.${dayKeys[date.getDay()]}`).substring(0, 2);
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
