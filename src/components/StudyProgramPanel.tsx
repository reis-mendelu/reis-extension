import React, { useMemo } from 'react';
import { useStudyProgram } from '../hooks/useStudyProgram';
import { BookOpen, AlertCircle, GraduationCap, RotateCcw } from 'lucide-react';
import { CourseList } from './StudyProgram/CourseList';

export const StudyProgramPanel: React.FC<any> = ({ onSelectSubject }) => {
    const { data, loading, error, reload, sync } = useStudyProgram();
    const grouped = useMemo(() => {
        if (!data?.finalTable) return [];
        const m: Record<string, any> = {};
        data.finalTable.forEach(c => {
            if (!m[c.Semester]) m[c.Semester] = { name: c.Semester, cats: {} };
            if (!m[c.Semester].cats[c.Category]) m[c.Semester].cats[c.Category] = [];
            m[c.Semester].cats[c.Category].push(c);
        });
        return Object.values(m);
    }, [data]);

    const onSubClick = (c: any) => {
        const match = c.Link.match(/predmet=(\d+)/);
        onSelectSubject?.({ courseCode: c.Code, courseName: c.Name, courseId: match?.[1] || '', id: `study-${c.Code}`, isFromSearch: true });
    };

    if (loading && !data) return (<div className="h-full flex flex-col overflow-hidden bg-base-100"><div className="p-4 border-b border-base-200"><div className="skeleton h-5 w-32"></div></div><div className="flex-1 p-4 grid grid-cols-1 xl:grid-cols-2 gap-6"><div className="skeleton h-40 w-full"></div></div></div>);
    if (error && !data) return (<div className="flex flex-col items-center justify-center h-full text-error p-6 text-center"><AlertCircle className="w-12 h-12 mb-4" /><p>{error}</p><button onClick={() => { sync().then(reload); }} className="btn btn-outline btn-error mt-4"><RotateCcw className="w-4 h-4" /> Zkusit znovu</button></div>);
    if (!data || !grouped.length) return (<div className="flex flex-col items-center justify-center h-full text-base-content/50 p-6 text-center"><BookOpen className="w-16 h-16 mb-4 opacity-20" /><h2 className="text-xl font-semibold opacity-70">Žádný studijní plán</h2><button onClick={() => { sync().then(reload); }} className="btn btn-primary mt-6"><RotateCcw className="w-4 h-4" /> Načíst</button></div>);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-base-100">
            <div className="p-4 border-b border-base-200 bg-base-100/50 backdrop-blur-sm z-10"><div className="flex items-center gap-3"><div className="p-1.5 bg-primary/10 rounded-lg text-primary"><GraduationCap className="w-5 h-5" /></div><h1 className="text-xl font-bold">Studijní plán</h1></div></div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
                    {grouped.map(sem => (
                        <div key={sem.name} className="space-y-4">
                            <div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-primary rounded-full"></div><h2 className="text-base font-bold text-primary">{sem.name}</h2></div>
                            <div className="space-y-4">{Object.entries(sem.cats).map(([cat, cs]) => (<div key={cat} className="space-y-1.5"><h3 className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 flex items-center gap-2 pl-3">{cat}<div className="h-[1px] bg-base-200 flex-1"></div></h3><CourseList courses={cs} onSelect={onSubClick} /></div>))}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default StudyProgramPanel;
