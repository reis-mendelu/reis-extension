export interface CountdownInfo { isLocked: boolean; timeUntil: number; formatted: string; days: number; hours: number; minutes: number; seconds: number; }

export function parseCzechDate(s: string): Date {
    const [d, t] = s.split(' '), [day, month, year] = d.split('.').map(Number), [h, m] = t?.split(':').map(Number) ?? [0, 0];
    return new Date(year, month - 1, day, h, m);
}

export function formatCountdown(ms: number): string {
    if (ms <= 0) return 'Registrace otevřena';
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function getCountdown(start: string | undefined, now: Date): CountdownInfo | null {
    if (!start) return null;
    try {
        const sd = parseCzechDate(start), ms = sd.getTime() - now.getTime(), s = Math.max(0, Math.floor(ms / 1000));
        return { isLocked: ms > 0, timeUntil: ms, formatted: formatCountdown(ms), days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
    } catch { return null; }
}
