const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DMY_RE = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/;

export const RECENT_THRESHOLD_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * Parse an IS Mendelu file date string. Accepts "DD.MM.YYYY" (primary) and
 * "YYYY-MM-DD" (ISO fallback). Returns null when unparseable, when the date
 * is invalid (e.g. 31.02.), or when the input is empty.
 */
export function parseIsDate(raw: string | undefined | null): Date | null {
    if (!raw) return null;
    const s = raw.trim();
    if (!s) return null;

    const iso = ISO_RE.exec(s);
    if (iso) {
        const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        return isValid(d, Number(iso[1]), Number(iso[2]), Number(iso[3])) ? d : null;
    }

    const dmy = DMY_RE.exec(s);
    if (dmy) {
        const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        return isValid(d, Number(dmy[3]), Number(dmy[2]), Number(dmy[1])) ? d : null;
    }

    return null;
}

function isValid(d: Date, y: number, m: number, day: number): boolean {
    return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

/**
 * True if `raw` parses to a date within the last `thresholdDays` (default 14)
 * relative to `now`. Future dates also count as recent (a teacher uploads a
 * file dated tomorrow → still "NEW").
 */
export function isRecent(raw: string | undefined | null, now: number = Date.now(), thresholdDays = RECENT_THRESHOLD_DAYS): boolean {
    const d = parseIsDate(raw);
    if (!d) return false;
    const diff = now - d.getTime();
    return diff < thresholdDays * DAY_MS;
}
