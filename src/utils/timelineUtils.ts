/**
 * Utility functions for Exam Timeline calculations and formatting.
 */

/**
 * Parse DD.MM.YYYY date string to Date object.
 */
export function parseTimelineDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Calculate days between two dates.
 */
export function daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format date for display (e.g., "18.12.")
 */
export function formatShortDate(dateStr: string): string {
    const [day, month] = dateStr.split('.');
    return `${day}.${month}.`;
}

/**
 * Get exam urgency color based on days until exam.
 */
export function getExamUrgency(dateStr: string): { colorClass: string; pulse: boolean } {
    const examDate = parseTimelineDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil(
        (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    let result: { colorClass: string; pulse: boolean };
    if (daysUntil <= 1) result = { colorClass: 'text-error', pulse: true };
    else if (daysUntil <= 4) result = { colorClass: 'text-warning', pulse: false };
    else if (daysUntil <= 7) result = { colorClass: 'text-success', pulse: false };
    else result = { colorClass: 'text-primary', pulse: false };

    return result;
}
