import { ChevronDown } from 'lucide-react';
import { AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { ExamSectionItem } from './ExamSectionItem';

export function ExamSubjectItem({ subject, processingId, onOpenPicker }: any) {
    const isReg = subject.sections.some((s: any) => s.status === 'registered');
    return (
        <AccordionItem value={subject.id} className="border-b border-slate-100 last:border-0">
            <AccordionHeader className="flex">
                <AccordionTrigger className="flex flex-1 items-center justify-between px-6 py-4 bg-white hover:bg-slate-50 group data-[state=open]:bg-slate-50/50">
                    <div className="flex flex-col items-start gap-0.5">
                        <span className="font-semibold text-slate-900 text-base truncate max-w-[350px]">{subject.name}</span>
                        <span className="text-xs text-slate-500 font-medium">{subject.code}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isReg && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                        <ChevronDown className="text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" size={16} />
                    </div>
                </AccordionTrigger>
            </AccordionHeader>
            <AccordionContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div className="px-6 py-4 bg-slate-50/50 space-y-2">
                    {subject.sections.map((sec: any) => (
                        <ExamSectionItem key={sec.id} section={sec} isProcessing={processingId === sec.id} onOpenPicker={onOpenPicker} />
                    ))}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}
