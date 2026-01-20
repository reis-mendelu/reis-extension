import { useSyllabus } from '../../hooks/data';
import { useUserParams } from '../../hooks/useUserParams';
import { BookOpen, Info } from 'lucide-react';

interface SyllabusTabProps {
    courseCode: string;
}

export function SyllabusTab({ courseCode }: SyllabusTabProps) {
    const { syllabus, isLoading } = useSyllabus(courseCode);
    const { params } = useUserParams();
    const studyForm = params?.studyForm; // 'prez' or 'komb'

    // Initial loading or missing data
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 animate-pulse">
                <div className="w-12 h-12 bg-base-300 rounded mb-4"></div>
                <div className="h-4 bg-base-300 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-base-300 rounded w-1/3"></div>
            </div>
        );
    }

    if (!syllabus || (!syllabus.requirementsText && syllabus.requirementsTable.length === 0)) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-base-content/40">
                <BookOpen className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-sm">Pro tento předmět nejsou dostupné požadavky.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-base-100 p-6 space-y-8">
            {/* 1. Requirements Text */}
            {syllabus.requirementsText && (
                <div className="prose prose-sm max-w-none">
                    <h3 className="text-base font-bold text-base-content mb-4 flex items-center gap-2">
                        <Info size={18} className="text-primary" />
                        Podmínky ukončení
                    </h3>
                    <div className="bg-base-200/30 rounded-xl p-5 border border-base-200">
                        {syllabus.requirementsText.split('\n').filter(line => line.trim()).map((line, i) => {
                            const trimmed = line.trim();
                            
                            // Helper to highlight important numbers and terms
                            const highlightText = (text: string) => {
                                const parts = text.split(/((?:min\.|max\.)?\s*\d+(?:[\.,]\d+)?\s*(?:bodů|bodu|body|b\.|%)|(?:A|B|C|D|E|F)\s*\([^)]+\)|Zkouška|Zápočet)/g);
                                return parts.map((part, index) => {
                                    // Highlight numbers/points/percentages
                                    if (part.match(/(?:min\.|max\.)?\s*\d+(?:[\.,]\d+)?\s*(?:bodů|bodu|body|b\.|%)/)) {
                                        return <span key={index} className="font-bold text-primary">{part}</span>;
                                    }
                                    // Highlight Grades logic if inside text
                                    if (part.match(/^(?:A|B|C|D|E|F)\s*\([^)]+\)/)) {
                                        return <span key={index} className="font-bold text-base-content">{part}</span>;
                                    }
                                    // Highlight keywords
                                    if (part === 'Zkouška' || part === 'Zápočet') {
                                        return <span key={index} className="font-semibold text-base-content underline decoration-primary/30 decoration-2 underline-offset-2">{part}</span>;
                                    }
                                    return part;
                                });
                            };

                            // 1. Detect Bullet Points (starts with - or •)
                            if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
                                return (
                                    <div key={i} className="flex gap-3 ml-1 mb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                        <span className="text-base-content/80 leading-relaxed">
                                            {highlightText(trimmed.substring(1).trim())}
                                        </span>
                                    </div>
                                );
                            }

                            // 2. Detect Grade Scales (e.g. "A (90), B (80)...")
                            if (trimmed.match(/^[A-F] \(/)) {
                                const grades = trimmed.split(/, ?(?=[A-F] \()/);
                                return (
                                    <div key={i} className="flex flex-wrap gap-2 my-2">
                                        {grades.map((grade, g) => (
                                            <span key={g} className="badge badge-ghost py-3 h-auto border-base-300 bg-base-100 text-base-content/90 font-medium text-xs">
                                                {grade.trim()}
                                            </span>
                                        ))}
                                    </div>
                                );
                            }

                            // 3. Detect Headers (short line ending in colon)
                            if (trimmed.length < 50 && trimmed.endsWith(':')) {
                                return (
                                    <h4 key={i} className="font-bold text-base-content mt-4 mb-2">
                                        {trimmed}
                                    </h4>
                                );
                            }

                            // 4. Regular Paragraphs
                            return (
                                <p key={i} className="mb-3 text-base-content/80 leading-relaxed last:mb-0">
                                    {highlightText(trimmed)}
                                </p>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 2. Grading Table */}
            {syllabus.requirementsTable.length > 0 && (() => {
                const headers = syllabus.requirementsTable[0];
                
                // Determine logic for column filtering
                // We want to hide "Kombinované" if user is "prez", and vice versa.
                let filteredColumnIndices = headers.map((_, i) => i);
                
                if (studyForm === 'prez') {
                    // Hide columns that look like combined study
                    filteredColumnIndices = filteredColumnIndices.filter(i => 
                        !headers[i].toLowerCase().includes('kombinovan')
                    );
                } else if (studyForm === 'komb') {
                    // Hide columns that look like full-time study
                    filteredColumnIndices = filteredColumnIndices.filter(i => 
                        !headers[i].toLowerCase().includes('prezenčn')
                    );
                }

                // If we filtered out all study columns by mistake, fallback to all
                if (filteredColumnIndices.length <= 1) {
                    filteredColumnIndices = headers.map((_, i) => i);
                }

                return (
                    <div>
                        <h3 className="text-base font-bold text-base-content mb-3">Bodové rozdělení</h3>
                        <div className="overflow-x-auto border border-base-200 rounded-lg">
                            <table className="table table-sm w-full">
                                <thead>
                                    <tr className="bg-base-200 text-base-content">
                                        {filteredColumnIndices.map(i => {
                                            let headerLabel = headers[i];
                                            // Rename study form to more generic/compact "Váha" if filtered
                                            if (i > 0 && (headerLabel.toLowerCase().includes('prezenč') || headerLabel.toLowerCase().includes('kombinovan'))) {
                                                headerLabel = 'Váha';
                                            }
                                            return (
                                                <th key={i} className={`font-semibold ${i > 0 ? 'text-center' : ''}`}>
                                                    {headerLabel}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {syllabus.requirementsTable.slice(1).map((row, rowIndex) => (
                                        <tr key={rowIndex} className="border-b border-base-200 last:border-0 hover:bg-base-200/30">
                                            {filteredColumnIndices.map(colIndex => (
                                                <td key={colIndex} className={colIndex > 0 ? 'text-center font-mono' : ''}>
                                                    {row[colIndex]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}
            

        </div>
    );
}
