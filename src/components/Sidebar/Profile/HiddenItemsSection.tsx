import { EyeOff, RotateCcw, Calendar, CalendarRange, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';

export function HiddenItemsSection() {
    const { t } = useTranslation();
    const hiddenItems = useAppStore(s => s.hiddenItems);
    const unhideCourse = useAppStore(s => s.unhideCourse);
    const unhideEvent = useAppStore(s => s.unhideEvent);
    const [expanded, setExpanded] = useState(false);

    const hasHiddenItems = hiddenItems.courses.length > 0 || hiddenItems.events.length > 0;

    if (!hasHiddenItems) return null;

    return (
        <div className="py-1">
            <button 
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between gap-3 px-1 py-2 hover:bg-base-200 rounded-lg group transition-colors"
            >
                <div className="flex items-center gap-2 flex-1">
                    <EyeOff size={16} className="text-base-content/50" />
                    <span className="text-xs opacity-70">{t('calendar.hide.hiddenItems')}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="badge badge-sm badge-ghost opacity-50 px-1.5 h-5">
                        {hiddenItems.courses.length + hiddenItems.events.length}
                    </span>
                    {expanded ? <ChevronDown size={14} className="opacity-40" /> : <ChevronRight size={14} className="opacity-40" />}
                </div>
            </button>

            {expanded && (
                <div className="mt-1 flex flex-col gap-1 px-1 max-h-[152px] overflow-y-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-transparent pr-1">
                    {hiddenItems.courses.map((course, idx) => (
                        <div key={`${course.courseCode}-${course.type}-${idx}`} className="flex items-center gap-3 p-2 bg-base-200/50 rounded-lg group/item">
                            <CalendarRange size={14} className="text-primary/60 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate leading-tight">{course.courseName}</p>
                                <p className="text-[10px] opacity-50 uppercase tracking-wider">
                                    {!course.type || course.type === 'all' 
                                        ? t('calendar.hide.all') 
                                        : course.type === 'seminar' 
                                          ? t('course.badge.seminar') 
                                          : t('course.badge.lecture')}
                                </p>
                            </div>
                            <button 
                                onClick={() => unhideCourse(course.courseCode, course.type)}
                                className="btn btn-ghost btn-xs btn-circle hover:bg-primary/20 hover:text-primary transition-colors shrink-0"
                                title={t('calendar.hide.restore')}
                            >
                                <RotateCcw size={14} />
                            </button>
                        </div>
                    ))}
                    {hiddenItems.events.map(event => (
                        <div key={event.id} className="flex items-center gap-3 p-2 bg-base-200/50 rounded-lg group/item">
                            <Calendar size={14} className="text-info/60 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate leading-tight">{event.courseName}</p>
                                <p className="text-[10px] opacity-50 uppercase tracking-wider">
                                    {t('calendar.hide.single')} • {event.date.substring(6, 8)}. {event.date.substring(4, 6)}.
                                </p>
                            </div>
                            <button 
                                onClick={() => unhideEvent(event.id)}
                                className="btn btn-ghost btn-xs btn-circle hover:bg-primary/20 hover:text-primary transition-colors shrink-0"
                                title={t('calendar.hide.restore')}
                            >
                                <RotateCcw size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
