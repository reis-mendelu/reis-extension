import { GraduationCap, ArrowRight } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface ExamHandoffBannerProps {
    onOpenExams: () => void;
}

/**
 * Shown at the top of the calendar during the exam period when there are exam
 * terms the student can register for. The calendar is the wrong instrument for
 * month-spanning sparse registration, so it hands off to the Exams view (which
 * already provides the full register/unregister surface) rather than hosting it.
 */
export function ExamHandoffBanner({ onOpenExams }: ExamHandoffBannerProps) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            onClick={onOpenExams}
            className="btn btn-block btn-sm h-auto py-2 justify-between bg-primary/10 hover:bg-primary/15 border-none text-primary font-bold normal-case rounded-none"
        >
            <span className="flex items-center gap-2">
                <GraduationCap size={16} className="shrink-0" aria-hidden="true" />
                {t('calendar.examPeriodBanner.label')}
            </span>
            <span className="flex items-center gap-1.5 text-xs">
                {t('calendar.examPeriodBanner.action')}
                <ArrowRight size={14} aria-hidden="true" />
            </span>
        </button>
    );
}
