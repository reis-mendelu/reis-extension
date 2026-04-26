const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

export function formatTime(ms: number): string {
    const d = new Date(ms);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

export function isStale(syncedAt: number, now: number = Date.now()): boolean {
    return now - syncedAt > STALE_AFTER_MS;
}

export function parseCzechDate(s: string): Date | null {
    // CZ: D.M.YYYY  |  EN: M/D/YYYY
    const czMatch = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
    if (czMatch) {
        const [, d, mo, y] = czMatch;
        const date = new Date(Number(y), Number(mo) - 1, Number(d));
        return Number.isFinite(date.getTime()) ? date : null;
    }
    const enMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (enMatch) {
        const [, mo, d, y] = enMatch;
        const date = new Date(Number(y), Number(mo) - 1, Number(d));
        return Number.isFinite(date.getTime()) ? date : null;
    }
    return null;
}

export function daysUntil(target: Date, now: Date = new Date()): number {
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    return Math.round((startOfTarget - startOfNow) / (24 * 60 * 60 * 1000));
}
