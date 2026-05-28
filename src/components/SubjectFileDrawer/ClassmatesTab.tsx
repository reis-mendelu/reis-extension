import { useState, useMemo } from 'react';
import { Search, User, Users } from 'lucide-react';
import { useClassmates } from '../../hooks/data/useClassmates';
import { useTranslation } from '../../hooks/useTranslation';
import { ClassmatesListSkeleton } from './ClassmatesListSkeleton';
import { useAppStore } from '../../store/useAppStore';
import { ISBacklink } from './ISBacklink';
import { ClassmatePersonDrawer } from '../Classmates/ClassmatePersonDrawer';
import { PersonPhoto } from '../ui/PersonPhoto';
import type { Classmate } from '../../types/classmates';

interface ClassmatesTabProps {
    courseCode: string;
}

export function ClassmatesTab({ courseCode }: ClassmatesTabProps) {
    const { t, language } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [selected, setSelected] = useState<Classmate | null>(null);
    const { classmates, isLoading, error } = useClassmates(courseCode);
    const subjectInfo = useAppStore(s => courseCode ? s.subjects?.data[courseCode] : undefined);
    const studium = useAppStore(s => s.studiumId);
    const obdobi = useAppStore(s => s.obdobiId);

    const lang = language === 'cz' ? 'cz' : 'en';
    const subjectId = subjectInfo?.subjectId;
    const classmatesUrl = studium && obdobi
        ? (subjectId
            ? `https://is.mendelu.cz/auth/student/spoluzaci.pl?predmet=${subjectId};;studium=${studium};obdobi=${obdobi};lang=${lang}`
            : `https://is.mendelu.cz/auth/student/spoluzaci.pl?studium=${studium};obdobi=${obdobi};lang=${lang}`)
        : null;

    const translate = (key: string, fallback: string) => {
        const result = t(key);
        return result === key ? fallback : result;
    };

    const filteredClassmates = useMemo(() => {
        const list = classmates ?? [];
        if (!searchQuery) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.personId.toString().includes(q)
        );
    }, [classmates, searchQuery]);

    const renderBody = () => {
        if (isLoading) {
            return <ClassmatesListSkeleton message={translate('classmates.loadingSeminar', 'Načítám spolužáky z cvičení...')} />;
        }
        if (error && filteredClassmates.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                    <Users size={48} className="mb-4 opacity-20" />
                    <p>{translate('classmates.loadFailed', 'Nepodařilo se načíst spolužáky')}</p>
                </div>
            );
        }
        if (filteredClassmates.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                    <Users size={48} className="mb-4 opacity-20" />
                    <p>{translate('classmates.noneFound', 'Žádní spolužáci nenalezeni')}</p>
                </div>
            );
        }
        return (
            <div className="grid grid-cols-1 gap-3">
                {filteredClassmates.map((student) => (
                    <div
                        key={student.personId}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(student)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelected(student);
                            }
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-base-200 bg-base-100 hover:border-primary/20 hover:shadow-sm transition-all group cursor-pointer text-left"
                    >
                        <div className="flex items-center gap-4 group/profile flex-1">
                            <div className="avatar">
                                <div className="w-14 h-14 rounded-full ring-1 ring-base-200 ring-offset-base-100 ring-offset-2 group-hover/profile:ring-primary/40 transition-all">
                                    <PersonPhoto
                                        personId={student.personId}
                                        alt={student.name}
                                        className="w-full h-full object-cover scale-[1.05]"
                                        fallback={
                                            <div className="bg-neutral text-neutral-content w-full h-full flex items-center justify-center">
                                                <User size={24} strokeWidth={1.5} />
                                            </div>
                                        }
                                    />
                                </div>
                            </div>
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
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-base-100">
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
            {isLoading ? renderBody() : (
                <div className="flex-1 overflow-y-auto p-4">
                    {renderBody()}
                    {classmatesUrl && <ISBacklink href={classmatesUrl} />}
                </div>
            )}
            <ClassmatePersonDrawer classmate={selected} onClose={() => setSelected(null)} />
        </div>
    );
}
