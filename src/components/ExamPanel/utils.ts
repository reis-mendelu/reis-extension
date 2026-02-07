/**
 * ExamPanel Shared Utilities
 */

/**
 * Get day of week abbreviation from date string.
 */
export function getDayOfWeek(dateString: string, t: (k: string) => string): string {
    const [day, month, year] = dateString.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return t(`days.${dayKeys[date.getDay()]}`).substring(0, 2);
}

/**
 * Parse capacity string (e.g., "18/20") to percentage.
 */
export function capacityToPercent(capacity?: string): number {
    if (!capacity) return 0;
    const [occupied, total] = capacity.split('/').map(Number);
    if (isNaN(occupied) || isNaN(total) || total === 0) return 0;
    return Math.min(100, (occupied / total) * 100);
}

/**
 * Format timestamp to relative time string.
 */
export function formatRelativeTime(timestamp: number | null, t: (k: string) => string, lang: string): string {
    if (!timestamp) return t('common.loading');

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) return lang === 'cs' ? 'Právě teď' : 'Just now';
    if (diffMinutes < 60) return lang === 'cs' ? `Před ${diffMinutes} min` : `${diffMinutes} min ago`;
    if (diffHours < 24) return lang === 'cs' ? `Před ${diffHours} h` : `${diffHours} h ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'numeric' });
}
