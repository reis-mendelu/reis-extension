/**
 * ExamTimeline - Horizontal timeline showing registered exams with gap indicators.
 * Decomposed v4.0 (See src/components/timeline/)
 */

import { useMemo } from 'react';
import { AlertCircle, CalendarCheck } from 'lucide-react';
import type { ExamSubject, RegisteredExam } from '../types/exams';
import { getStoredSuccessRates } from '../api/successRate';
import { parseTimelineDate, daysBetween } from '../utils/timelineUtils';
import { TimelineGap } from './timeline/TimelineGap';
import { ExamCard } from './timeline/ExamCard';
import { SpacingScore } from './timeline/SpacingScore';

interface ExamTimelineProps {
    exams: ExamSubject[];
}

export function ExamTimeline({ exams }: ExamTimelineProps) {
    // Extract registered exams from all subjects
    const registeredExams = useMemo<(RegisteredExam & { successRate?: number })[]>(() => {
        const registered: (RegisteredExam & { successRate?: number })[] = [];
        const ratesData = getStoredSuccessRates()?.data || {};

        exams.forEach(subject => {
            const subjectStats = ratesData[subject.code]?.stats;
            let subjectRate: number | undefined;

            if (subjectStats && subjectStats.length > 0) {
                // Calculate aggregated success rate across all semesters
                let totalPass = 0;
                let totalFail = 0;
                subjectStats.forEach(sem => {
                    totalPass += sem.totalPass;
                    totalFail += sem.totalFail;
                });
                if (totalPass + totalFail > 0) {
                    subjectRate = totalPass / (totalPass + totalFail);
                }
            }

            subject.sections.forEach(section => {
                if (section.status === 'registered' && section.registeredTerm) {
                    registered.push({
                        code: subject.code,
                        name: subject.name,
                        sectionName: section.name,
                        date: section.registeredTerm.date,
                        time: section.registeredTerm.time,
                        room: section.registeredTerm.room,
                        successRate: subjectRate
                    });
                }
            });
        });

        // Sort by date
        return registered.sort((a, b) =>
            parseTimelineDate(a.date).getTime() - parseTimelineDate(b.date).getTime()
        );
    }, [exams]);

    // Calculate spacing score (0-100) based on gaps between exams
    const spacingScore = useMemo(() => {
        if (registeredExams.length < 2) return 100;
        let score = 100;
        for (let i = 1; i < registeredExams.length; i++) {
            const gap = daysBetween(
                parseTimelineDate(registeredExams[i - 1].date),
                parseTimelineDate(registeredExams[i].date)
            );
            if (gap < 2) score -= 30;
            else if (gap < 4) score -= 10;
        }
        return Math.max(0, score);
    }, [registeredExams]);

    // If no registered exams, show empty state
    if (registeredExams.length === 0) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 bg-base-200 rounded-lg text-base-content/60">
                <AlertCircle size={16} />
                <span className="text-sm">Žádné přihlášené zkoušky</span>
            </div>
        );
    }

    // Build timeline items list (Exams + Gaps)
    const timelineItems: Array<
        | { type: 'exam'; exam: RegisteredExam & { successRate?: number }; isHighRisk: boolean }
        | { type: 'gap'; days: number; nextExamRate?: number }
    > = [];

    registeredExams.forEach((exam, index) => {
        let isHighRisk = false;

        // Add gap indicator before this exam (except first)
        if (index > 0) {
            const prevExam = registeredExams[index - 1];
            const days = daysBetween(parseTimelineDate(prevExam.date), parseTimelineDate(exam.date));
            
            // Check for High Risk Collision (Gap <= 2 days AND Success Rate < 60%)
            if (days <= 2 && exam.successRate !== undefined && exam.successRate < 0.6) {
                isHighRisk = true;
            }

            // Store the success rate of the UPCOMING exam (the one user is cramming for)
            timelineItems.push({ type: 'gap', days, nextExamRate: exam.successRate });
        }

        timelineItems.push({ type: 'exam', exam, isHighRisk });
    });

    return (
        <div className="px-4 py-3 bg-base-200 rounded-lg overflow-x-auto">
            {/* Main Header */}
            <div className="flex items-center gap-2 mb-3">
                <CalendarCheck size={18} className="text-primary" />
                <h3 className="font-semibold text-base-content">Přihlášené zkoušky</h3>
            </div>
            
            {/* Spacing Score Header */}
            {registeredExams.length >= 2 && (
                <SpacingScore score={spacingScore} />
            )}

            <ul className="timeline timeline-horizontal w-full">
                {timelineItems.map((item, index) => {
                    if (item.type === 'gap') {
                        return (
                            <TimelineGap 
                                key={`gap-${index}`}
                                days={item.days}
                                nextExamRate={item.nextExamRate}
                            />
                        );
                    }

                    return (
                        <ExamCard
                            key={`exam-${item.exam.code}-${item.exam.date}`}
                            exam={item.exam}
                            isFirst={index === 0}
                            isLast={index === timelineItems.length - 1}
                            isHighRisk={item.isHighRisk}
                        />
                    );
                })}
            </ul>
        </div>
    );
}
