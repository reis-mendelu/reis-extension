export function relativeTime(isoDate: string, t: (key: string, params?: Record<string, string | number>) => string): string {
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diffMs / 86400000);
    if (days === 0) return t('courseTips.today');
    if (days === 1) return t('courseTips.yesterday');
    if (days < 7) return t('courseTips.daysAgo', { count: days });
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return t('courseTips.weeksAgo', { count: weeks });
    return t('courseTips.monthsAgo', { count: Math.floor(days / 30) });
}
