import { Users, Mail } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

interface ExamClassmatesPopoverProps {
    terminId: string;
}

function initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function ExamClassmatesPopover({ terminId }: ExamClassmatesPopoverProps) {
    const { t } = useTranslation();
    const classmates = useAppStore(s => s.examClassmates[terminId]);

    if (!classmates) return null;

    return (
        <div className="dropdown dropdown-top dropdown-end">
            <button
                tabIndex={0}
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            >
                <Users size={11} />
                {classmates.length}
            </button>
            <div
                tabIndex={0}
                className="dropdown-content z-50 card card-compact shadow-xl border border-base-200 bg-base-100 w-72 mt-1"
                onClick={e => e.stopPropagation()}
            >
                <div className="card-body p-0">
                    <div className="px-3 py-2 border-b border-base-200 text-[11px] font-black uppercase tracking-widest opacity-40">
                        {classmates.length} {t('exams.classmatesLabel')}
                    </div>
                    <ul className="overflow-y-auto max-h-64 divide-y divide-base-200/50">
                        {classmates.length === 0 ? (
                            <li className="px-3 py-4 text-center text-xs opacity-40">{t('exams.noClassmates')}</li>
                        ) : classmates.map(c => (
                            <li key={c.personId} className="flex items-center gap-2.5 px-3 py-2 hover:bg-base-200/50 transition-colors">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
                                    {initials(c.name)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-semibold truncate">{c.name}</div>
                                    {c.studyInfo && <div className="text-[10px] opacity-40 truncate">{c.studyInfo}</div>}
                                </div>
                                {c.messageUrl && (
                                    <a
                                        href={`https://is.mendelu.cz${c.messageUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className="btn btn-circle btn-xs btn-ghost text-base-content/30 hover:text-primary hover:bg-primary/10 shrink-0"
                                    >
                                        <Mail size={12} />
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
