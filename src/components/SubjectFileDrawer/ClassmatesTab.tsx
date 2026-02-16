import { useState, useMemo } from 'react';
import { Search, Mail, User, Users, School } from 'lucide-react';
import { useClassmates } from '../../hooks/data/useClassmates';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { ClassmatesListSkeleton } from './ClassmatesListSkeleton';

interface ClassmatesTabProps {
    courseCode: string;
    skupinaId?: string;
}

export function ClassmatesTab({ courseCode, skupinaId: propsSkupinaId }: ClassmatesTabProps) {
    const { t } = useTranslation();
    
    // Try to get skupinaId from props first, then fall back to subjects store
    const subjectInfo = useAppStore(state => state.subjects?.data?.[courseCode]);
    const skupinaId = propsSkupinaId || subjectInfo?.skupinaId;
    
    const [filter, setFilter] = useState<'all' | 'seminar'>(skupinaId ? 'seminar' : 'all');
    const [searchQuery, setSearchQuery] = useState('');
    const { classmates, isLoading, isPriorityLoading } = useClassmates(courseCode, filter);

    const translate = (key: string, fallback: string) => {
        const result = t(key);
        return result === key ? fallback : result;
    };

    const filteredClassmates = useMemo(() => {
        if (!searchQuery) return classmates;
        const q = searchQuery.toLowerCase();
        return classmates.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.personId && c.personId.toString().includes(q))
        );
    }, [classmates, searchQuery]);
    
    const isEmpty = !classmates || classmates.length === 0;
    const showSkeleton = isPriorityLoading && isEmpty;
    
    // Create progress message for skeleton
    const getProgressMessage = () => {
        const filterText = filter === 'seminar' ? 
            translate('classmates.loadingSeminar', 'Loading seminar classmates...') :
            translate('classmates.loadingAll', 'Loading classmates...');
        return filterText;
    };

    return (
        <div className="flex flex-col h-full bg-base-100">
            {/* Controls Header */}
            <div className="flex flex-col gap-4 p-6 border-b border-base-300">
                <div className="flex items-center justify-between gap-4">
                    {/* Filter Toggle */}
                    <div className="join bg-base-200 p-1 rounded-lg h-10 flex">
                        <button
                            className={`join-item btn btn-xs sm:btn-sm border-none h-full ${filter === 'all' ? 'bg-base-100 shadow-sm text-primary' : 'bg-transparent text-base-content/60 hover:text-base-content/80'}`}
                            onClick={() => setFilter('all')}
                        >
                            <Users size={16} className="mr-2" />
                            {translate('classmates.all', 'Všichni')}
                        </button>
                        <button
                            className={`join-item btn btn-xs sm:btn-sm border-none h-full ${filter === 'seminar' ? 'bg-base-100 shadow-sm text-primary' : 'bg-transparent text-base-content/60 hover:text-base-content/80'}`}
                            onClick={() => setFilter('seminar')}
                            disabled={!skupinaId}
                        >
                            <School size={16} className="mr-2" />
                            {translate('classmates.seminar', 'Cvičení')}
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative flex-1 max-w-[240px]">
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
            </div>

            {/* List Content */}
            {showSkeleton ? (
                <ClassmatesListSkeleton message={getProgressMessage()} />
            ) : (
                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                             <span className="loading loading-spinner loading-md"></span>
                        </div>
                    ) : filteredClassmates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
                            <Users size={48} className="mb-4 opacity-20" />
                            <p>{translate('classmates.noneFound', 'Žádní spolužáci nenalezeni')}</p>
                        </div>
                    ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {filteredClassmates.map((student) => (
                            <div key={student.personId} className="flex items-center justify-between p-3 rounded-xl border border-base-200 bg-base-100 hover:border-primary/20 hover:shadow-sm transition-all group">
                                <div className="flex items-center gap-4">
                                    {/* Avatar */}
                                    <div className="avatar">
                                        <div className="w-12 h-12 rounded-full ring-1 ring-base-200 ring-offset-base-100 ring-offset-2">
                                            {student.photoUrl ? (
                                                <img src={student.photoUrl.startsWith('http') ? student.photoUrl : `https://is.mendelu.cz${student.photoUrl}`} alt={student.name} />
                                            ) : (
                                                <div className="bg-neutral text-neutral-content w-full h-full flex items-center justify-center">
                                                    <User size={20} />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-base-content leading-tight">
                                                {student.name}
                                            </span>
                                            {student.studyInfo && (
                                                <>
                                                    <span className="text-base-content/20">•</span>
                                                    <span className="text-xs text-base-content/60 line-clamp-1 max-w-[150px] md:max-w-[250px] mt-0.5" title={student.studyInfo}>
                                                        {student.studyInfo}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-0.5 mt-0.5">
                                             {student.personId !== 0 && (
                                                <span className="text-xs text-base-content/50 font-mono">
                                                    ID: {student.personId}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

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
                                            <Mail size={18} />
                                        </a>
                                    ) : (
                                        <span className="btn btn-circle btn-sm btn-ghost text-base-content/20 cursor-not-allowed">
                                            <Mail size={18} />
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
