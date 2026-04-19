import { Mail } from 'lucide-react';
import type { Classmate } from '../../types/classmates';
import { useTranslation } from '../../hooks/useTranslation';

interface ExamClassmatesListProps {
    classmates: Classmate[];
}

function initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function ExamClassmatesList({ classmates }: ExamClassmatesListProps) {
    const { t } = useTranslation();
    return (
        <div className="mt-2 rounded-lg border border-base-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            {classmates.length === 0 ? (
                <div className="px-3 py-3 text-xs opacity-40 text-center">{t('exams.noClassmates')}</div>
            ) : (
                <ul className="divide-y divide-base-200/50 max-h-52 overflow-y-auto">
                    {classmates.map(c => (
                        <li key={c.personId} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-base-200/50 transition-colors">
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0">
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
            )}
        </div>
    );
}
