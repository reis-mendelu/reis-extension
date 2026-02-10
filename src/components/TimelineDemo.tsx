import React from 'react';
import ExamTimeline from './Exams/Timeline/ExamTimeline';
import type { ExamTerm } from '../types/exams';

interface TimelineDemoProps {
    onViewChange?: (view: any) => void;
}

export const TimelineDemo: React.FC<TimelineDemoProps> = ({ onViewChange }) => {
    // Adjust dates to be relative to "now" for better demo
    const now = new Date();
    const formatDate = (date: Date) => {
        const d = date.getDate().toString().padStart(2, '0');
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const y = date.getFullYear();
        return `${d}.${m}.${y}`;
    };

    const demoExams = [
        {
            term: {
                id: 'past-1',
                date: formatDate(new Date(now.getTime() - 86400000 * 2)), // 2 days ago
                time: '09:00',
                room: 'Q21',
            } as ExamTerm,
            subjectName: 'Matematika I',
        },
        {
            term: {
                id: 'next-1',
                date: formatDate(new Date(now.getTime() + 86400000 * 1)), // Tomorrow
                time: '10:00',
                room: 'B02',
            } as ExamTerm,
            subjectName: 'Algoritmizace',
        },
        {
            term: {
                id: 'future-1',
                date: formatDate(new Date(now.getTime() + 86400000 * 5)), // 5 days later
                time: '13:00',
                room: 'C33',
            } as ExamTerm,
            subjectName: 'Databázové systémy',
        }
    ];

    return (
        <div className="h-full overflow-y-auto bg-base-200/30 p-4 md:p-10">
            <div className="max-w-2xl mx-auto mb-6">
                <button 
                    onClick={() => onViewChange?.('exams')}
                    className="btn btn-sm btn-ghost gap-2 text-base-content/60 hover:text-primary"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                    Zpět na zkoušky
                </button>
            </div>
            <ExamTimeline exams={demoExams} />
        </div>
    );
};
