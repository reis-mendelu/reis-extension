/**
 * ExamPanel Shared Utilities
 */
import { parseRegistrationStart } from '../../utils/termUtils';
import type { ExamSection } from '../../types/exams';

export type SectionState =
    | { type: 'open'; openCount: number }
    | { type: 'opening'; earliest: Date }
    | { type: 'noInfo' }   // terms exist but no registration info yet
    | { type: 'empty' };   // no terms at all

export function getSectionState(section: ExamSection, now: Date): SectionState {
    if (!section.terms.length) return { type: 'empty' };

    const openCount = section.terms.filter(t =>
        t.canRegisterNow === true &&
        !t.full &&
        !(t.capacity && t.capacity.occupied >= t.capacity.total)
    ).length;
    if (openCount > 0) return { type: 'open', openCount };

    const futureDates = section.terms
        .map(t => t.registrationStart ? parseRegistrationStart(t.registrationStart) : null)
        .filter((d): d is Date => d !== null && d > now)
        .sort((a, b) => a.getTime() - b.getTime());
    if (futureDates.length) return { type: 'opening', earliest: futureDates[0] };

    const allBlocked = section.terms.every(t =>
        t.canRegisterNow === false ||
        t.full ||
        (t.capacity && t.capacity.occupied >= t.capacity.total)
    );
    if (allBlocked) return { type: 'empty' };

    return { type: 'noInfo' };
}

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

    if (diffMinutes < 1) return lang === 'cz' ? 'Právě teď' : 'Just now';
    if (diffMinutes < 60) return lang === 'cz' ? `Před ${diffMinutes} min` : `${diffMinutes} min ago`;
    if (diffHours < 24) return lang === 'cz' ? `Před ${diffHours} h` : `${diffHours} h ago`;

    const date = new Date(timestamp);
    return date.toLocaleDateString(lang === 'cz' ? 'cs-CZ' : 'en-US', { day: 'numeric', month: 'numeric' });
}
