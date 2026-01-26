import { ExternalLink } from 'lucide-react';
import type { StudyProgramCourse } from '../../api/studyProgram';

export function CourseList({ courses, onSelect }: any) {
    return (
        <div className="space-y-1 pl-3">
            {courses.map((c: StudyProgramCourse) => (
                <div key={`${c.Code}-${c.Semester}`} onClick={() => onSelect(c)}
                     className="group flex items-center gap-3 p-2 bg-base-200/30 hover:bg-base-200 rounded-md transition-all border border-transparent hover:border-base-300 cursor-pointer">
                    <div className="w-20 font-mono text-[11px] font-medium text-base-content/50 group-hover:text-primary">{c.Code}</div>
                    <div className="flex-1 min-w-0 font-medium text-sm text-base-content truncate group-hover:text-primary">{c.Name}</div>
                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${c.Completion.toLowerCase().includes('zkouška') ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-green-500/10 text-green-600 dark:text-green-400'}`}>
                        {c.Completion.toLowerCase().includes('zkouška') ? 'zk' : 'z'}
                    </div>
                    <div className="w-8 text-right text-[11px] font-bold text-base-content/30 group-hover:text-base-content/60">{c.Credits}</div>
                    {c.Link !== "N/A" && (
                        <a href={c.Link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-base-300 rounded text-base-content/20 hover:text-primary transition-colors">
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
}
