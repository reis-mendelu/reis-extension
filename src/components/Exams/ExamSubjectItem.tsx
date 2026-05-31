import { ChevronDown } from 'lucide-react';
import { AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { ExamSectionItem } from './ExamSectionItem';

import type { ExamSubject, ExamSection } from '../../types/exams';
import { useCourseName } from '../../hooks/ui/useCourseName';

interface ExamSubjectItemProps {
    subject: ExamSubject;
    processingId: string | null;
    onOpenPicker: (sec: ExamSection, b: HTMLElement) => void;
}

export function ExamSubjectItem({ subject, processingId, onOpenPicker }: ExamSubjectItemProps) {
    const isReg = subject.sections.some((s: ExamSection) => s.status === 'registered');
    const displayName = useCourseName(subject.code, subject.name);
    return (
        <AccordionItem value={subject.id} className="border-b border-base-300 last:border-0">
            <AccordionHeader className="flex">
                <AccordionTrigger className="flex flex-1 items-center justify-between px-6 py-4 bg-base-100 hover:bg-base-200 group data-[state=open]:bg-base-200/50">
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="font-semibold text-base-content text-base truncate max-w-[350px]">{displayName}</span>
                        <span className="text-xs text-base-content/60 font-medium">{subject.code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isReg && <div className="w-2 h-2 rounded-full bg-warning" />}
                        <ChevronDown className="text-base-content/50 transition-transform duration-200 group-data-[state=open]:rotate-180" size={16} />
                    </div>
                </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="px-6 py-4 bg-base-200/50 space-y-2">
                    {subject.sections.map((sec: ExamSection) => (
                        <ExamSectionItem key={sec.id} section={sec} isProcessing={processingId === sec.id} onOpenPicker={onOpenPicker} />
                    ))}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}
