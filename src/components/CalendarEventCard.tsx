/**
 * CalendarEventCard - Event card component matching Figma design.
 * 
 * Uses workspace semantic colors (exam-*, lecture-*, seminar-*).
 * Renders with adaptive content based on event duration.
 * 
 * NOTE: This component fills its parent container. Positioning is handled by the parent.
 */

import { MapPin, EyeOff, Calendar, CalendarRange, Timer } from 'lucide-react';
import type { BlockLesson } from '../types/calendarTypes';
import { useCourseName } from '../hooks/ui/useCourseName';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';
import { useTimeline } from '../hooks/useTimeline';
import { useHintStatus } from '../hooks/ui/useHintStatus';
import { toast } from 'sonner';

interface CalendarEventCardProps {
    lesson: BlockLesson;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    language?: string; // Language for localization
}

// Helper function to get localized course name
function getLocalizedCourseName(lesson: BlockLesson, language?: string): string {
    if (language === 'en' && lesson.courseNameEn) {
        return lesson.courseNameEn;
    }
    return lesson.courseNameCs || lesson.courseName;
}

// Helper function to get localized room name
function getLocalizedRoom(lesson: BlockLesson, language?: string): string {
    if (language === 'en' && lesson.roomEn) {
        return lesson.roomEn;
    }
    return lesson.roomCs || lesson.room;
}

// Calculate duration in minutes from time strings
function calculateDuration(startTime: string, endTime: string): number {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    return (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
}

// Extract exam section name from the composite title
function getExamSectionName(courseName: string): string {
    // The format from WeeklyCalendar is `${subject.name} - ${section.name}`
    // We want to extract just the section name part
    const parts = courseName.split(' - ');
    if (parts.length > 1) {
        return parts[parts.length - 1];
    }
    return courseName;
}

export function CalendarEventCard({ lesson, onClick, language }: CalendarEventCardProps) {
    const { t } = useTranslation();
    const { isSeen, markSeen } = useHintStatus('calendar_hide_first_time');
    const hideEvent = useAppStore(s => s.hideEvent);
    const hideCourse = useAppStore(s => s.hideCourse);
    const timeline = useTimeline(lesson.courseCode || '');

    const duration = calculateDuration(lesson.startTime, lesson.endTime);
    const isLongEnough = duration >= 60; // Only show location if event is 1 hour+

    const handleHideOccurrence = (e: React.MouseEvent) => {
        e.stopPropagation();
        hideEvent(lesson.id, lesson.courseCode, fullName, lesson.date);
        showHint();
    };

    const handleHideType = (e: React.MouseEvent) => {
        e.stopPropagation();
        const type = lesson.isSeminar === 'true' ? 'seminar' : 'lecture';
        hideCourse(lesson.courseCode, fullName, type);
        showHint();
    };

    const handleHideAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        hideCourse(lesson.courseCode, fullName, 'all');
        showHint();
    };

    const showHint = () => {
        if (!isSeen) {
            toast.info(t('calendar.hide.hint'), {
                duration: 5000,
            });
            markSeen();
        }
    };

    // Get localized names and apply nickname
    const fullName = getLocalizedCourseName(lesson, language);
    const baseOnly = fullName.split(' - ')[0];
    const nickname = useAppStore(state => state.courseNicknames?.[lesson.courseCode || '']);
    const baseName = useCourseName(lesson.courseCode, baseOnly);
    const courseName = lesson.isExam
        ? `${baseName} - ${getExamSectionName(fullName)}`
        : nickname ? baseName : fullName;
    const room = getLocalizedRoom(lesson, language);

    // Determine event type and colors using workspace tokens
    const getEventStyles = () => {
        if (lesson.isExam) {
            return {
                bg: 'bg-exam-bg/85',
                border: 'border-l-exam-border',
                text: 'text-gray-900',
            };
        } else if (lesson.isSeminar === 'true') {
            return {
                bg: 'bg-seminar-bg/85',
                border: 'border-l-seminar-border',
                text: 'text-gray-900',
            };
        } else {
            return {
                bg: 'bg-lecture-bg/85',
                border: 'border-l-lecture-border',
                text: 'text-gray-900',
            };
        }
    };

    const styles = getEventStyles();

    // For exams: show the section name (e.g. "Průběžný test 2")
    // For others: show the full course name
    const courseTitle = lesson.isExam
        ? getExamSectionName(courseName)
        : courseName;

    return (
        <div
            className={`h-full mx-1 rounded cursor-pointer group 
                        ${styles.bg} border-l-4 ${styles.border} relative`}
            onClick={onClick}
            title={`${courseTitle}\n${lesson.startTime} - ${lesson.endTime}\n${room}\n${lesson.teachers[0]?.shortName || ''}`}
        >
            {/* Deadline countdown badge */}
            {timeline && timeline.weeksLeft <= 4 && !lesson.isExam && (
                <div className={`absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold z-10 group-hover:opacity-0 transition-opacity ${
                    timeline.weeksLeft === 0
                        ? 'bg-error/15 text-error'
                        : timeline.weeksLeft <= 2
                        ? 'bg-warning/15 text-warning-content'
                        : 'bg-info/15 text-info'
                }`}>
                    <Timer size={10} />
                    <span>{timeline.short}</span>
                </div>
            )}
            {/* Quick Hide Action */}
            {!lesson.isExam && (
                <div 
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="dropdown dropdown-end">
                        <div 
                            tabIndex={0} 
                            role="button" 
                            className="btn btn-ghost btn-xs btn-circle bg-base-100/50 hover:bg-base-100 shadow-sm"
                        >
                            <EyeOff size={14} className="text-base-content/70" />
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-[100] menu p-1 shadow-xl bg-base-100 border border-base-300 rounded-lg w-52 text-xs font-medium mt-1">
                            <li className="menu-title px-2 py-1 text-[10px] opacity-40 uppercase tracking-widest border-b border-base-200 mb-1 line-clamp-2 whitespace-normal leading-tight">
                                {baseName}
                            </li>
                            <li>
                                <button onClick={handleHideOccurrence} className="flex items-center gap-2 py-2">
                                    <Calendar size={14} />
                                    {t('calendar.hide.occurrence')}
                                </button>
                            </li>
                            <li>
                                <button onClick={handleHideType} className="flex items-center gap-2 py-2">
                                    <CalendarRange size={14} />
                                    {lesson.isSeminar === 'true' ? t('calendar.hide.seminars') : t('calendar.hide.lectures')}
                                </button>
                            </li>
                            <div className="h-px bg-base-300 my-1 opacity-50" />
                            <li>
                                <button onClick={handleHideAll} className="flex items-center gap-2 py-2 opacity-70">
                                    <EyeOff size={14} />
                                    {t('calendar.hide.allLessons')}
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            )}
            <div className="p-2 h-full flex flex-col text-sm overflow-hidden font-inter">
                {/* Course title - always visible */}
                <div className={`font-semibold ${styles.text} flex-shrink-0 break-words line-clamp-2 ${!lesson.isExam ? 'pr-8' : ''}`}>
                    {courseTitle}
                </div>
                {/* Additional course info - only for longer events */}
                {isLongEnough && lesson.isExam && (
                    <div className="text-exam-text font-medium text-xs flex-shrink-0">
                        {courseName.split(' - ')[0]}
                    </div>
                )}

                {/* Bottom row - Location and Time, pushed to bottom */}
                {isLongEnough && (
                    <div className="text-gray-600 text-sm mt-auto flex-shrink-0 flex items-center justify-between gap-2">
                        {room && (
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                                <MapPin size={12} className="flex-shrink-0" />
                                <span className="truncate">{room}</span>
                            </div>
                        )}
                        <div className="text-gray-500 whitespace-nowrap flex-shrink-0">
                            {lesson.startTime} - {lesson.endTime}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
