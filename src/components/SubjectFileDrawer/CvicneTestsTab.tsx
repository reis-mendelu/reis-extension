import { ExternalLink, Upload, ChevronDown, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useCvicneTests, useOdevzdavarny, useAssessments, useSubjects } from '../../hooks/data';
import { useUserParams } from '../../hooks/useUserParams';
import { useTranslation } from '../../hooks/useTranslation';
import { AttendanceSection } from './AttendanceSection';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';

interface CvicneTestsTabProps {
    lesson: BlockLesson | SelectedSubject | null;
}

export function CvicneTestsTab({ lesson }: CvicneTestsTabProps) {
    const { t, language } = useTranslation();
    const { tests, status: testsStatus } = useCvicneTests(lesson?.courseName);
    const { assignments, status: assignmentsStatus } = useOdevzdavarny(lesson?.courseName);
    const { assessments, isLoading: assessmentsLoading } = useAssessments(lesson?.courseCode);
    const { getSubject } = useSubjects();
    const { params } = useUserParams();
    const lang = language === 'cz' ? 'cz' : 'en';
    const studium = params?.studium;
    const obdobi = params?.obdobi;
    const subjectId = lesson?.courseCode ? getSubject(lesson.courseCode)?.subjectId : undefined;


    const [testsOpen, setTestsOpen] = useState(true);
    const [assignmentsOpen, setAssignmentsOpen] = useState(true);
    const [testResultsOpen, setTestResultsOpen] = useState(false);

    // Close sections if they are empty by default
    useEffect(() => {
        if (testsStatus === 'success' && tests.length === 0) {
            queueMicrotask(() => setTestsOpen(false));
        }
    }, [testsStatus, tests.length]);

    useEffect(() => {
        if (assignmentsStatus === 'success' && assignments.length === 0) {
            queueMicrotask(() => setAssignmentsOpen(false));
        }
    }, [assignmentsStatus, assignments.length]);

    const isLoading = testsStatus === 'loading' && assignmentsStatus === 'loading';
    const isEmpty = tests.length === 0 && assignments.length === 0;

    if (isLoading && isEmpty && assessmentsLoading) {
        return (
            <div className="flex flex-col gap-3 p-4">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl">
                        <div className="skeleton h-4 w-2/3" />
                        <div className="skeleton h-8 w-20 rounded-xl" />
                    </div>
                ))}
            </div>
        );
    }

    const testResultsUrl = (studium && obdobi && subjectId) ? `https://is.mendelu.cz/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${subjectId};test=1;lang=${lang}` : undefined;
    const prubezneUrl = (studium && obdobi && subjectId) ? `https://is.mendelu.cz/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${subjectId};prubezne=1;lang=${lang}` : undefined;

    return (
        <div className="flex flex-col h-full bg-base-100 overflow-y-auto w-full">
            <div className="p-6 space-y-6 flex-1">
                <AttendanceSection courseCode={lesson?.courseCode || ''} />
                <Section
                    title={t('course.cvicneTests.tests') || 'Cvičné testy'}
                    count={tests.length}
                    isOpen={testsOpen}
                    onToggle={() => setTestsOpen(!testsOpen)}
                    externalUrl={studium ? `https://is.mendelu.cz/auth/elis/student/seznam_osnov.pl?studium=${studium};lang=${lang}` : undefined}
                >
                    {tests.length === 0 ? (
                        <p className="text-xs text-base-content/40 px-3 py-2">
                            {t('course.cvicneTests.noTests') || 'Žádné úkoly ani cv. testy k dispozici.'}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {tests.map(test => (
                                <a key={test.url} href={test.url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-between gap-2 p-3 rounded-xl hover:bg-base-200 active:scale-[0.99] transition-all animate-in fade-in slide-in-from-left-2 duration-300 cursor-pointer group">
                                    <span className="font-medium text-base-content/80 text-sm truncate min-w-0">
                                        {test.name}
                                    </span>
                                    <ExternalLink size={16} className="text-base-content/30 group-hover:text-primary shrink-0 transition-colors" />
                                </a>
                            ))}
                        </div>
                    )}
                </Section>

                <Section
                    title={t('course.cvicneTests.assignments') || 'Odevzdávárny'}
                    count={assignments.length}
                    isOpen={assignmentsOpen}
                    onToggle={() => setAssignmentsOpen(!assignmentsOpen)}
                    externalUrl={(studium && obdobi) ? `https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=${studium};obdobi=${obdobi};lang=${lang}` : undefined}
                >
                    {assignments.length === 0 ? (
                        <p className="text-xs text-base-content/40 px-3 py-2">
                            {t('course.cvicneTests.noAssignments') || 'Žádné odevzdávárny k dispozici.'}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {assignments.map(a => (
                                <a key={a.odevzdavarnaId || a.name} href={a.uploadUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center justify-between gap-2 p-3 rounded-xl hover:bg-base-200 active:scale-[0.99] transition-all animate-in fade-in slide-in-from-left-2 duration-300 cursor-pointer group">
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="font-medium text-base-content/80 text-sm truncate">
                                            {a.name}
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {a.deadline && (
                                                <span className="flex items-center gap-1 text-[10px] text-base-content/50">
                                                    <Clock size={10} />
                                                    <span className="font-semibold">{t('course.cvicneTests.deadlineLabel')}:</span>
                                                    {a.deadline}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-0.5 text-[10px] text-base-content/40">
                                                <Upload size={10} /> {a.fileCount}
                                            </span>
                                        </div>
                                    </div>
                                    <ExternalLink size={16} className="text-base-content/30 group-hover:text-primary shrink-0 transition-colors" />
                                </a>
                            ))}
                        </div>
                    )}
                </Section>

                <Section
                    title={t('course.cvicneTests.testResults') || 'Výsledky testů'}
                    count={assessments?.length ?? 0}
                    isOpen={testResultsOpen}
                    onToggle={() => setTestResultsOpen(!testResultsOpen)}
                    externalUrl={testResultsUrl}
                >
                    {!assessments || assessments.length === 0 ? (
                        <p className="text-xs text-base-content/40 px-3 py-2">
                            {t('course.cvicneTests.noTestResults')}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {assessments.map((a, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-xl hover:bg-base-200 transition-all">
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="font-medium text-base-content/80 text-sm truncate">{a.name}</span>
                                        <span className="text-[10px] text-base-content/50">{a.submittedDate}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-sm font-medium text-base-content/70">{a.score}/{a.maxScore}</span>
                                        <span className={`text-xs font-bold ${a.successRate >= 50 ? 'text-success' : 'text-error'}`}>{a.successRate} %</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Section>

                {prubezneUrl && (
                    <Section
                        title={t('course.cvicneTests.continuousAssessment') || 'Průběžné hodnocení'}
                        count={0}
                        isOpen={false}
                        onToggle={() => {}}
                        externalUrl={prubezneUrl}
                        linkOnly
                    />
                )}
            </div>
        </div>
    );
}

function Section({ title, count, isOpen, onToggle, externalUrl, linkOnly, children }: {
    title: string; count: number; isOpen: boolean; onToggle: () => void;
    externalUrl?: string; linkOnly?: boolean; children?: React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-3">
                {linkOnly ? (
                    <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-base-content/40 hover:text-primary transition-colors">
                        <h3 className="text-xs font-bold uppercase tracking-wider">{title}</h3>
                        <ExternalLink size={12} />
                    </a>
                ) : (
                    <>
                        <button onClick={onToggle} className="flex items-center gap-1.5 cursor-pointer">
                            <ChevronDown size={14} className={`text-base-content/30 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/40">
                                {title} ({count})
                            </h3>
                        </button>
                        {externalUrl && (
                            <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="text-base-content/20 hover:text-primary transition-colors">
                                <ExternalLink size={14} />
                            </a>
                        )}
                    </>
                )}
            </div>
            {isOpen && !linkOnly && children}
        </div>
    );
}
