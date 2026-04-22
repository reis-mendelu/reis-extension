import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { getWeekForDate } from '../api/teachingWeek';
import { useTranslation } from './useTranslation';

export interface TimelineCountdown {
    label: string;
    weeksLeft: number;
    formatted: string;
    /** Compact form for tight spaces, e.g. "2w" or "now" */
    short: string;
    isToday: boolean;
    isPassed: boolean;
}

export function useTimeline(courseCode: string): TimelineCountdown | null {
    const { t } = useTranslation();
    const teachingWeekData = useAppStore(s => s.teachingWeekData);
    const courseDeadlines = useAppStore(s => s.courseDeadlines);

    return useMemo(() => {
        if (!teachingWeekData || !courseDeadlines[courseCode]) return null;

        const currentWeek = teachingWeekData.currentWeek ?? getWeekForDate(teachingWeekData, new Date());
        if (currentWeek === null) return null;

        const deadlines = courseDeadlines[courseCode];
        
        // Find the nearest upcoming (or current) deadline
        const upcomingDeadlines = deadlines
            .filter(d => d.week >= currentWeek)
            .sort((a, b) => a.week - b.week);

        if (upcomingDeadlines.length === 0) return null;

        const nearest = upcomingDeadlines[0];
        const weeksLeft = nearest.week - currentWeek;
        
        let formatted = '';
        if (weeksLeft === 0) {
            formatted = t('timeline.thisWeek', { label: nearest.label.toLowerCase() });
        } else if (weeksLeft === 1) {
            formatted = t('timeline.nextWeek', { label: nearest.label.toLowerCase() });
        } else {
            const pluralKey = (weeksLeft >= 2 && weeksLeft <= 4) ? 'inWeeks24' : 'inWeeks5plus';
            formatted = t(`timeline.${pluralKey}`, { label: nearest.label.toLowerCase(), count: weeksLeft });
        }

        const short = weeksLeft === 0 ? '!' : t('timeline.shortWeek', { count: weeksLeft });

        return {
            label: nearest.label,
            weeksLeft,
            formatted,
            short,
            isToday: weeksLeft === 0,
            isPassed: false // Filters already removed passed ones
        };
    }, [teachingWeekData, courseDeadlines, courseCode, t]);
}
