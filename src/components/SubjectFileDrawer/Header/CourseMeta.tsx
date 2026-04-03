import { User, Map as MapIcon, Clock, ChevronDown, ChevronUp, Timer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';
import type { BlockLesson } from '../../../types/calendarTypes';
import type { CourseMetadata } from '../../../types/documents';
import { PersonHoverCard } from '../../PersonHoverCard';
import { MapHoverCard } from '../../MapHoverCard';
import { useTimeline } from '../../../hooks/useTimeline';

export function CourseMeta({ lesson, courseInfo, isSearchContext }: { lesson: BlockLesson | null; courseInfo: CourseMetadata | undefined; isSearchContext: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const { t, language } = useTranslation();
    const courseCode = lesson?.courseCode || courseInfo?.courseCode;
    const timeline = useTimeline(courseCode || '');

    if (!isSearchContext) {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 text-sm text-base-content/60 flex-wrap">
                    {/* ... teachers, rooms, etc. */}
                {lesson?.teachers && lesson.teachers.length > 0 && (
                    lesson.teachers[0].id ?
                        <PersonHoverCard personId={String(lesson.teachers[0].id)} className="flex items-center gap-1">
                            <a href={`https://is.mendelu.cz/auth/lide/clovek.pl?;id=${lesson.teachers[0].id};lang=${language === 'cz' ? 'cz' : 'en'}`} target="_blank" rel="noopener noreferrer" className="clickable-link flex items-center gap-1"><User size={14} /><span>{lesson.teachers[0].fullName}</span></a>
                        </PersonHoverCard>
                    : <span className="flex items-center gap-1"><User size={14} /><span>{lesson.teachers.map(t => t.fullName).join(', ')}</span></span>
                )}
                {lesson?.room?.startsWith('Q') && (
                    <MapHoverCard roomName={lesson.room} className="flex items-center">
                        <button onClick={() => window.open(`https://mm.mendelu.cz/mapwidget/embed?placeName=${lesson.room}`, '_blank')} className="flex items-center gap-1 hover:text-emerald-600 transition-colors">
                            <MapIcon size={14} /><span>{lesson.room}</span>
                        </button>
                    </MapHoverCard>
                )}
                {lesson?.startTime && <span className="flex items-center gap-1"><Clock size={14} /><span>{lesson.startTime} - {lesson.endTime}</span></span>}
            </div>
            {timeline && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary/60 mt-1">
                    <Timer size={12} />
                    <span>{timeline.formatted}</span>
                </div>
            )}
        </div>
        );
    }
    const displayed = expanded ? courseInfo?.teachers : courseInfo?.teachers?.slice(0, 3);
    return (
        <div className="flex flex-col gap-2 w-full mt-1 text-sm text-base-content/60">
            {courseInfo?.garant && (
                <div className="flex items-center gap-2">
                    <User size={14} className="text-base-content/30" />
                    <span className="text-[13px] text-base-content/40 italic font-bold">
                        {t('course.garant')}{' '}
                        <span className="font-bold text-base-content/70 not-italic">
                            {courseInfo.garant.id ? (
                                <PersonHoverCard personId={String(courseInfo.garant.id)}>
                                    <a
                                        href={`https://is.mendelu.cz/auth/lide/clovek.pl?id=${courseInfo.garant.id};lang=${language}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline"
                                    >
                                        {courseInfo.garant.name}
                                    </a>
                                </PersonHoverCard>
                            ) : (
                                courseInfo.garant.name
                            )}
                        </span>
                    </span>
                </div>
            )}
            {(courseInfo?.teachers?.length ?? 0) > 0 && (
                <div className="flex items-start gap-2">
                    <span className="text-[13px] text-base-content/40 italic font-bold mt-0.5">{t('course.teachers')}</span>
                    <div className="flex flex-col gap-1.5 flex-1">
                        {displayed?.map((teacher, i) => (
                            <div key={i} className="flex items-center gap-2 leading-none">
                                <span className="text-[13px] font-bold text-base-content/70">
                                    {teacher.id ? (
                                        <PersonHoverCard personId={String(teacher.id)}>
                                            <a
                                                href={`https://is.mendelu.cz/auth/lide/clovek.pl?id=${teacher.id};lang=${language}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:underline"
                                            >
                                                {teacher.name}
                                            </a>
                                        </PersonHoverCard>
                                    ) : (
                                        teacher.name
                                    )}
                                </span>
                                {teacher.roles && <span className="hidden sm:inline text-[11px] text-base-content/40">({teacher.roles.toLowerCase()})</span>}
                            </div>
                        ))}
                        {(courseInfo?.teachers?.length ?? 0) > 3 && (
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className="flex items-center gap-1 text-[11px] font-bold text-primary"
                            >
                                {expanded
                                    ? <><span>{t('course.showLess')}</span><ChevronUp size={12} /></>
                                    : <><span>{t('course.showMore')} ({(courseInfo?.teachers?.length ?? 0) - 3})</span><ChevronDown size={12} /></>
                                }
                            </button>
                        )}
                    </div>
                </div>
            )}
            {timeline && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary/60 mt-1">
                    <Timer size={12} />
                    <span>{timeline.formatted}</span>
                </div>
            )}
        </div>
    );
}
