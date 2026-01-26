import { User, Map as MapIcon, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

export function CourseMeta({ lesson, courseInfo, isSearchContext }: any) {
    const [expanded, setExpanded] = useState(false);
    if (!isSearchContext) {
        return (
            <div className="flex items-center gap-4 text-sm text-base-content/60 flex-wrap">
                {lesson?.teachers?.length > 0 && (
                    lesson.teachers[0].id ? <a href={`https://is.mendelu.cz/auth/lide/clovek.pl?;id=${lesson.teachers[0].id};lang=cz`} target="_blank" rel="noopener noreferrer" className="clickable-link flex items-center gap-1"><User size={14} /><span>{lesson.teachers[0].fullName}</span></a>
                    : <span className="flex items-center gap-1"><User size={14} /><span>{lesson.teachers.map((t: any) => t.fullName).join(', ')}</span></span>
                )}
                {lesson?.room?.startsWith('Q') && <button onClick={() => window.open(`https://mm.mendelu.cz/mapwidget/embed?placeName=${lesson.room}`, '_blank')} className="flex items-center gap-1 hover:text-emerald-600 transition-colors"><MapIcon size={14} /><span>{lesson.room}</span></button>}
                {lesson?.startTime && <span className="flex items-center gap-1"><Clock size={14} /><span>{lesson.startTime} - {lesson.endTime}</span></span>}
            </div>
        );
    }
    const displayed = expanded ? courseInfo?.teachers : courseInfo?.teachers?.slice(0, 3);
    return (
        <div className="flex flex-col gap-2 w-full mt-1 text-sm text-base-content/60">
            {courseInfo?.garant && <div className="flex items-center gap-2"><User size={14} className="text-base-content/30" /><span className="text-[13px] text-base-content/40 italic font-bold">Garant: <span className="font-bold text-base-content/70 not-italic">{courseInfo.garant}</span></span></div>}
            {courseInfo?.teachers?.length > 0 && (
                <div className="flex items-start gap-2"><span className="text-[13px] text-base-content/40 italic font-bold mt-0.5">Vyučující:</span>
                    <div className="flex flex-col gap-1.5 flex-1">{displayed?.map((t: any, i: number) => <div key={i} className="flex items-center gap-2 leading-none"><span className="text-[13px] font-bold text-base-content/70">{t.name}</span>{t.roles && <span className="text-[11px] text-base-content/40">({t.roles.toLowerCase()})</span>}</div>)}
                        {courseInfo.teachers.length > 3 && <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[11px] font-bold text-primary">{expanded ? <><span>Zobrazit méně</span><ChevronUp size={12} /></> : <><span>Zobrazit více ({courseInfo.teachers.length - 3})</span><ChevronDown size={12} /></>}</button>}
                    </div>
                </div>
            )}
        </div>
    );
}
