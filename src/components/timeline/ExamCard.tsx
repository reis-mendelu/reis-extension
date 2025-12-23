
import { CheckCircle, TriangleAlert } from 'lucide-react';
import type { RegisteredExam } from '../../types/exams';
import { formatShortDate, getExamUrgency } from '../../utils/timelineUtils';

interface ExamCardProps {
    exam: RegisteredExam & { successRate?: number };
    isFirst: boolean;
    isLast: boolean;
    isHighRisk: boolean;
}

export function ExamCard({ exam, isFirst, isLast, isHighRisk }: ExamCardProps) {
    const urgency = getExamUrgency(exam.date);
    const riskRate = exam.successRate ? Math.round(exam.successRate * 100) : 0;

    // Resolve color
    // We can't interpolate dynamic class names well with Tailwind JIT if they aren't full strings, 
    // but the getExamUrgency returns full classes like 'text-error'.
    // Logic: If Risk, override to error styling for certain elements.
    
    // Determine card styles
    const cardBorderClass = isHighRisk ? 'border-error bg-error/5' : 'bg-base-100 border-current';
    const titleClass = isHighRisk ? 'text-error' : urgency.colorClass;
    const hrColor = isHighRisk ? 'bg-error' : 'bg-primary';
    const iconColor = isHighRisk ? 'text-error' : urgency.colorClass;

    return (
        <li>
            {!isFirst && <hr className={hrColor} />}
            
            <div 
                className={`timeline-start timeline-box shadow-md border-l-[3px] ${cardBorderClass}`}
                style={{ borderColor: isHighRisk ? undefined : 'currentColor' }}
            >
                <div className="flex flex-col gap-1">
                    <div className={`font-bold text-sm ${titleClass} whitespace-nowrap flex items-center gap-2`} title={exam.name}>
                        {exam.name}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-xs text-base-content/60">{formatShortDate(exam.date)}</div>
                        
                        {isHighRisk && (
                            <div 
                                className="badge badge-error badge-xs gap-1 font-semibold text-white"
                                title="Průměrná úspěšnost předmětu"
                            >
                                <TriangleAlert size={8} />
                                Úsp. {riskRate}%
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={`timeline-middle ${iconColor} ${(urgency.pulse || isHighRisk) ? 'animate-pulse' : ''}`}>
               {isHighRisk ? <TriangleAlert size={16} /> : <CheckCircle size={16} />}
            </div>

            {!isLast && <hr className={hrColor} />}
        </li>
    );
}
