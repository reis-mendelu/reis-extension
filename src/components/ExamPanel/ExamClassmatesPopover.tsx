import { Mail, User } from 'lucide-react';
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
                <ul className="divide-y divide-base-200/50 max-h-72 overflow-y-auto">
                    {classmates.map(c => (
                        <li key={c.personId} className="flex items-center gap-3 px-3 py-2.5 hover:bg-base-200/50 transition-colors">
                            <div className="avatar shrink-0">
                                <div className="w-10 h-10 rounded-full ring-1 ring-base-200">
                                    {c.photoUrl && (
                                        <img
                                            src={c.photoUrl}
                                            alt={c.name}
                                            className="w-full h-full object-cover"
                                            onError={e => {
                                                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                                                if (fb) fb.style.display = 'flex';
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <div
                                        className="bg-primary/10 text-primary text-xs font-black w-full h-full items-center justify-center"
                                        style={{ display: c.photoUrl ? 'none' : 'flex' }}
                                    >
                                        {initials(c.name)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{c.name}</div>
                                {c.studyInfo && <div className="text-[11px] opacity-40 truncate">{c.studyInfo}</div>}
                            </div>
                            {c.messageUrl ? (
                                <a
                                    href={`https://is.mendelu.cz${c.messageUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="btn btn-circle btn-sm btn-ghost text-base-content/30 hover:text-primary hover:bg-primary/10 shrink-0"
                                >
                                    <Mail size={16} strokeWidth={1.5} />
                                </a>
                            ) : (
                                <span className="btn btn-circle btn-sm btn-ghost text-base-content/20 cursor-not-allowed shrink-0">
                                    <User size={16} strokeWidth={1.5} />
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
