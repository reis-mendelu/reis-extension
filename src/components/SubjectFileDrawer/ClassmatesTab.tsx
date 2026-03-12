import { useState, useMemo } from 'react';
import { Search, Mail, User, Users } from 'lucide-react';
import { useClassmates } from '../../hooks/data/useClassmates';
import { useTranslation } from '../../hooks/useTranslation';
import { ClassmatesListSkeleton } from './ClassmatesListSkeleton';

interface ClassmatesTabProps {
    courseCode: string;
}

export function ClassmatesTab({ courseCode }: ClassmatesTabProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const { classmates, isLoading } = useClassmates(courseCode);


    const translate = (key: string, fallback: string) => {
        const result = t(key);
        return result === key ? fallback : result;
    };

    const filteredClassmates = useMemo(() => {
        if (!searchQuery) return classmates;
        const q = searchQuery.toLowerCase();
        return classmates.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.personId.toString().includes(q)
        );
    }, [classmates, searchQuery]);

    return (
        <div className="flex flex-col h-full bg-base-100">
            {/* Search header */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-base-300">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder={translate('classmates.search', 'Vyhledat...')}
                        className="input input-sm input-bordered w-full h-10 pl-9 rounded-lg bg-base-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none z-10" />
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <ClassmatesListSkeleton message={translate('classmates.loadingSeminar', 'Načítám spolužáky z cvičení...')} />
            ) : (
                <div className="flex-1 overflow-y-auto p-4">
                    {filteredClassmates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                            <Users size={48} className="mb-4 opacity-20" />
                            <p>{translate('classmates.noneFound', 'Žádní spolužáci nenalezeni')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredClassmates.map((student) => (
                                <div key={student.personId} className="flex items-center justify-between p-3 rounded-xl border border-base-200 bg-base-100 hover:border-primary/20 hover:shadow-sm transition-all group">
                                    <a
                                        href={`https://is.mendelu.cz/auth/lide/clovek.pl?id=${student.personId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-4 group/profile flex-1"
                                    >
                                        {/* Avatar */}
                                        <div className="avatar">
                                            <div className="w-14 h-14 rounded-full ring-1 ring-base-200 ring-offset-base-100 ring-offset-2 group-hover/profile:ring-primary/40 transition-all">
                                                {student.photoUrl ? (
                                                    <img src={student.photoUrl.startsWith('http') ? student.photoUrl : `https://is.mendelu.cz${student.photoUrl}`} alt={student.name} className="w-full h-full object-cover scale-[1.05]" />
                                                ) : (
                                                    <div className="bg-neutral text-neutral-content w-full h-full flex items-center justify-center">
                                                        <User size={24} strokeWidth={1.5} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Info */}
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-base-content leading-tight">{student.name}</span>
                                                {student.studyInfo && (
                                                    <>
                                                        <span className="text-base-content/20">•</span>
                                                        <span className="text-xs text-base-content/60 line-clamp-1 max-w-[150px] md:max-w-[250px] mt-0.5" title={student.studyInfo}>
                                                            {student.studyInfo}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </a>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        {student.messageUrl ? (
                                            <a
                                                href={`https://is.mendelu.cz${student.messageUrl}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn btn-circle btn-sm btn-ghost text-base-content/40 hover:text-primary hover:bg-primary/10"
                                                title={student.name}
                                            >
                                                <Mail size={24} strokeWidth={1.5} />
                                            </a>
                                        ) : (
                                            <span className="btn btn-circle btn-sm btn-ghost text-base-content/20 cursor-not-allowed">
                                                <Mail size={24} strokeWidth={1.5} />
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
