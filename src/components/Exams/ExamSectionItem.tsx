import type { ExamSection } from '../../types/exams';
import { Button } from '../ui/button';

export function ExamSectionItem({ section, isProcessing, onOpenPicker }: { section: ExamSection; isProcessing: boolean; onOpenPicker: (section: ExamSection, target: HTMLElement) => void }) {
    const getDOW = (d: string) => {
        const [day, m, y] = d.split('.').map(Number);
        return ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'][new Date(y, m - 1, day).getDay()];
    };

    return (
        <div className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-white hover:shadow-sm hover:border-slate-200 transition-all">
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium text-slate-900 text-sm capitalize truncate" title={section.name}>{section.name}</span>
                {section.status === 'registered' && section.registeredTerm && (
                    <span className="text-xs text-slate-500">
                        {section.registeredTerm.date} {section.registeredTerm.time} ({getDOW(section.registeredTerm.date)})
                        {section.registeredTerm.room && ` • ${section.registeredTerm.room}`}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Button variant={section.status === 'registered' ? "ghost" : "default"} size="sm"
                        onClick={(e) => onOpenPicker(section, e.currentTarget)} disabled={isProcessing}
                        className={section.status === 'registered' ? "text-rose-500 hover:bg-rose-50" : "bg-indigo-600 hover:bg-indigo-700 text-white"}>
                    {section.status === 'registered' ? 'Změnit' : 'Vyber datum'}
                </Button>
            </div>
        </div>
    );
}
