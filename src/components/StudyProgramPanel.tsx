/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo } from 'react';
import { useStudyProgram } from '../hooks/useStudyProgram';
import type { StudyProgramCourse } from '../api/studyProgram';
import { BookOpen, AlertCircle, ExternalLink, GraduationCap, RotateCcw } from 'lucide-react';

interface StudyProgramPanelProps {
    onSelectSubject?: (subject: any) => void;
}

export const StudyProgramPanel: React.FC<StudyProgramPanelProps> = ({ onSelectSubject }) => {
    const { data, loading, error, reload, sync } = useStudyProgram();

    // Grouping logic for semesters and categories
    const groupedSemesters = useMemo(() => {
        if (!data?.finalTable) return [];
        
        const semestersMap: Record<string, {
            name: string;
            categories: Record<string, StudyProgramCourse[]>;
        }> = {};

        data.finalTable.forEach(course => {
            if (!semestersMap[course.Semester]) {
                semestersMap[course.Semester] = {
                    name: course.Semester,
                    categories: {}
                };
            }
            if (!semestersMap[course.Semester].categories[course.Category]) {
                semestersMap[course.Semester].categories[course.Category] = [];
            }
            semestersMap[course.Semester].categories[course.Category].push(course);
        });

        return Object.values(semestersMap);
    }, [data]);

    const handleRefresh = async () => {
        try {
            await sync();
            await reload();
        } catch (err) {
            console.error("Refresh failed", err);
        }
    };

    const handleSubjectClick = (course: StudyProgramCourse) => {
        let extractedId = '';
        if (course.Link && course.Link.includes('predmet=')) {
            const match = course.Link.match(/predmet=(\d+)/);
            if (match) extractedId = match[1];
        }

        if (onSelectSubject) {
            onSelectSubject({
                courseCode: course.Code,
                courseName: course.Name,
                courseId: extractedId,
                id: `study-${course.Code}`,
                date: '',
                startTime: '',
                endTime: '',
                room: '',
                teachers: [],
                isExam: false,
                isFromSearch: true, // Flag to indicate opened from list (for default tab)
            });
        }
    };

    if (loading && !data) {
        return (
            <div className="h-full flex flex-col overflow-hidden bg-base-100">
                {/* Skeleton Header */}
                <div className="p-4 border-b border-base-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="skeleton w-8 h-8 rounded-lg"></div>
                            <div className="space-y-1">
                                <div className="skeleton h-5 w-32"></div>
                                <div className="skeleton h-3 w-24"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Skeleton Content */}
                <div className="flex-1 p-4 grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="space-y-4">
                            <div className="skeleton h-7 w-48 rounded-full"></div>
                            <div className="space-y-2 pl-4">
                                <div className="skeleton h-4 w-40"></div>
                                {[1, 2, 3].map((j) => (
                                    <div key={j} className="skeleton h-10 w-full rounded-md"></div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-error p-6 text-center">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p>{error}</p>
                <button 
                    onClick={handleRefresh}
                    className="btn btn-outline btn-error mt-4 gap-2"
                >
                    <RotateCcw className="w-4 h-4" />
                    Zkusit znovu
                </button>
            </div>
        );
    }

    if (!data || groupedSemesters.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-base-content/50 p-6 text-center">
                <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                <h2 className="text-xl font-semibold opacity-70">Žádný studijní plán</h2>
                <p className="text-sm mt-2 max-w-md">
                    Nepodařilo se nalézt váš studijní plán. Ujistěte se, že jste přihlášeni v IS MENDELU a máte aktivní studium.
                </p>
                <button 
                    onClick={handleRefresh}
                    className="btn btn-primary mt-6 gap-2"
                    disabled={loading}
                >
                    <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Zkusit načíst znovu
                </button>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-base-100">
            {/* Header / Meta Info */}
            <div className="p-4 border-b border-base-200 bg-base-100/50 backdrop-blur-sm z-10">
                <div className="flex items-center justify-between gap-3">
                     <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                            <GraduationCap className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-base-content leading-tight">Studijní plán</h1>
                        </div>
                     </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-6">
                    {groupedSemesters.map((semester) => (
                        <div key={semester.name} className="space-y-4">
                            {/* Semester Header */}
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-primary rounded-full"></div>
                                <h2 className="text-base font-bold text-primary">
                                    {semester.name}
                                </h2>
                            </div>

                            {/* Category Sections */}
                            <div className="space-y-4">
                                {Object.entries(semester.categories).map(([categoryName, courses]) => (
                                    <div key={categoryName} className="space-y-1.5">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 flex items-center gap-2 pl-3">
                                            {categoryName}
                                            <div className="h-[1px] bg-base-200 flex-1"></div>
                                        </h3>
                                        
                                        <div className="space-y-1 pl-3">
                                            {courses.map((course) => (
                                                <div 
                                                    key={`${course.Code}-${course.Semester}`}
                                                    className="group flex items-center gap-3 p-2 bg-base-200/30 hover:bg-base-200 rounded-md transition-all border border-transparent hover:border-base-300 cursor-pointer"
                                                    onClick={() => handleSubjectClick(course)}
                                                >
                                                    {/* Course Code */}
                                                    <div className="w-20 font-mono text-[11px] font-medium text-base-content/50 group-hover:text-primary transition-colors">
                                                        {course.Code}
                                                    </div>

                                                    {/* Course Name */}
                                                    <div className="flex-1 min-w-0 font-medium text-sm text-base-content truncate group-hover:text-primary transition-colors">
                                                        {course.Name}
                                                    </div>

                                                    {/* Completion Badge */}
                                                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase
                                                        ${course.Completion.toLowerCase().includes('zkouška') 
                                                            ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
                                                            : 'bg-green-500/10 text-green-600 dark:text-green-400'}
                                                    `}>
                                                        {course.Completion.toLowerCase().includes('zkouška') ? 'zk' : 'z'}
                                                    </div>

                                                    {/* Credits */}
                                                    <div className="w-8 text-right text-[11px] font-bold text-base-content/30 group-hover:text-base-content/60">
                                                        {course.Credits}
                                                    </div>

                                                    {/* Link (Optional indicator) */}
                                                    {course.Link !== "N/A" && (
                                                        <a 
                                                            href={course.Link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-1 hover:bg-base-300 rounded text-base-content/20 hover:text-primary transition-colors"
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="Otevřít v IS"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                
                <div className="h-10"></div> {/* Compact bottom spacer */}
            </div>
        </div>
    );
};

export default StudyProgramPanel;
