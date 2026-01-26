import { useSyllabus } from '../../hooks/data';
import { useUserParams } from '../../hooks/useUserParams';
import { BookOpen } from 'lucide-react';
import { RequirementsSection } from './Syllabus/RequirementsSection';
import { GradingTable } from './Syllabus/GradingTable';

export function SyllabusTab({ courseCode, courseId, courseName, prefetchedResult }: any) {
    const hookRes = useSyllabus(courseCode, courseId, courseName);
    const { syllabus, isLoading } = prefetchedResult || hookRes;
    const { params } = useUserParams();

    if (isLoading) return <div className="flex flex-col items-center justify-center h-full p-8 animate-pulse"><div className="w-12 h-12 bg-base-300 rounded mb-4" /><div className="h-4 bg-base-300 rounded w-1/2 mb-2" /></div>;
    if (!syllabus || (!syllabus.requirementsText && !syllabus.requirementsTable.length)) return <div className="flex flex-col items-center justify-center h-full p-6 opacity-40 text-center"><BookOpen className="w-12 h-12 mb-3" /><p className="text-sm">Pro tento předmět nejsou dostupné požadavky.</p></div>;

    return (
        <div className="h-full overflow-y-auto bg-base-100 p-6 space-y-8">
            {syllabus.requirementsText && <RequirementsSection text={syllabus.requirementsText} />}
            {syllabus.requirementsTable.length > 0 && <GradingTable table={syllabus.requirementsTable} studyForm={params?.studyForm || 'prez'} />}
        </div>
    );
}
