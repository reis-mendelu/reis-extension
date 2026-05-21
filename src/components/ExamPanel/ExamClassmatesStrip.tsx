import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Mail, Search, Users } from 'lucide-react';
import { useExamClassmates } from '../../hooks/data/useExamClassmates';
import { useTranslation } from '../../hooks/useTranslation';
import type { Classmate } from '../../types/classmates';
import { ClassmatePersonDrawer } from '../Classmates/ClassmatePersonDrawer';

interface ExamClassmatesStripProps {
    terminId: string | undefined;
}

const PEEK_COUNT = 6;
const SEARCH_THRESHOLD = 12;

function initials(name: string): string {
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function Avatar({ classmate }: { classmate: Classmate }) {
    return (
        <div className="avatar">
            <div className="w-6 h-6 rounded-full ring-1 ring-base-100 bg-base-200">
                {classmate.photoUrl ? (
                    <img
                        src={classmate.photoUrl}
                        alt={classmate.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={e => {
                            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = 'flex';
                            e.currentTarget.style.display = 'none';
                        }}
                    />
                ) : null}
                <div
                    className="bg-primary/10 text-primary text-[9px] font-black w-full h-full items-center justify-center"
                    style={{ display: classmate.photoUrl ? 'none' : 'flex' }}
                >
                    {initials(classmate.name)}
                </div>
            </div>
        </div>
    );
}

function ClassmateChip({ classmate, onOpen }: { classmate: Classmate; onOpen: (c: Classmate) => void }) {
    return (
        <div className="group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-base-200 bg-base-100 hover:border-primary/20 hover:bg-primary/[0.02] transition-colors">
            <button
                type="button"
                onClick={e => { e.stopPropagation(); onOpen(classmate); }}
                className="flex-1 min-w-0 flex items-center gap-2 text-left"
                title={classmate.name}
            >
                <Avatar classmate={classmate} />
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate leading-tight">{classmate.name}</div>
                    {classmate.studyInfo && (
                        <div className="text-[10px] text-base-content/40 truncate leading-tight">{classmate.studyInfo}</div>
                    )}
                </div>
            </button>
            {classmate.messageUrl && (
                <a
                    href={`https://is.mendelu.cz${classmate.messageUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="btn btn-ghost btn-xs btn-circle text-base-content/30 hover:text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    title={classmate.name}
                >
                    <Mail size={12} />
                </a>
            )}
        </div>
    );
}

export function ExamClassmatesStrip({ terminId }: ExamClassmatesStripProps) {
    const { t } = useTranslation();
    const { classmates, isLoading } = useExamClassmates(terminId);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Classmate | null>(null);

    const filtered = useMemo(() => {
        const list = classmates ?? [];
        if (!query) return list;
        const q = query.toLowerCase();
        return list.filter(c => c.name.toLowerCase().includes(q));
    }, [classmates, query]);

    if (!terminId) return null;

    if (isLoading) {
        return (
            <div className="mt-2 pt-2 border-t border-base-200/60 flex items-center gap-2 text-[11px] text-base-content/40">
                <span className="loading loading-dots loading-xs" />
                <span>{t('exams.loadingClassmates')}</span>
            </div>
        );
    }

    if (!classmates || classmates.length === 0) return null;

    const peek = classmates.slice(0, PEEK_COUNT);
    const overflow = classmates.length - peek.length;

    return (
        <div className="mt-2 pt-2 border-t border-base-200/60" onClick={e => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setIsOpen(o => !o)}
                className="w-full flex items-center gap-2 px-1 py-1 -mx-1 rounded-md hover:bg-base-200/60 transition-colors group"
            >
                <Users size={12} className="text-base-content/40 shrink-0" />
                <div className="flex items-center">
                    {peek.map((c, i) => (
                        <div key={c.personId} className={i > 0 ? '-ml-2' : ''}>
                            <Avatar classmate={c} />
                        </div>
                    ))}
                    {overflow > 0 && (
                        <div className="-ml-2 w-6 h-6 rounded-full bg-base-200 ring-1 ring-base-100 flex items-center justify-center text-[9px] font-black text-base-content/60">
                            +{overflow}
                        </div>
                    )}
                </div>
                <span className="text-[11px] font-semibold text-base-content/60 ml-1">
                    {classmates.length} {t('exams.classmatesLabel')}
                </span>
                <span className="ml-auto text-base-content/30 group-hover:text-base-content/60 transition-colors">
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </span>
            </button>

            {isOpen && (
                <div className="mt-2 px-1">
                    {classmates.length >= SEARCH_THRESHOLD && (
                        <div className="relative mb-2">
                            <input
                                type="text"
                                placeholder={t('exams.searchClassmates')}
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                className="input input-sm input-bordered w-full h-8 pl-7 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                            />
                            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
                        {filtered.map(c => (
                            <ClassmateChip key={c.personId} classmate={c} onOpen={setSelected} />
                        ))}
                    </div>
                </div>
            )}
            <ClassmatePersonDrawer classmate={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
