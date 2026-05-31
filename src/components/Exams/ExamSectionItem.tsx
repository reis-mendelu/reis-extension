import type { ExamSection } from '../../types/exams';
import { Button } from '../ui/button';

export function ExamSectionItem({ section, isProcessing, onOpenPicker }: { section: ExamSection; isProcessing: boolean; onOpenPicker: (section: ExamSection, target: HTMLElement) => void }) {
    const getDOW = (d: string) => {
        const [day, m, y] = d.split('.').map(Number);
        return ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'][new Date(y, m - 1, day).getDay()];
    };

    return (
        <div className="group flex items-center justify-between p-3 rounded-lg border border-transparent hover:bg-base-100 hover:shadow-sm hover:border-base-300 transition-all">
            <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium text-base-content text-sm capitalize truncate" title={section.name}>{section.name}</span>
                {section.status === 'registered' && section.registeredTerm && (
                    <span className="text-xs text-base-content/60">
                        {section.registeredTerm.date} {section.registeredTerm.time} ({getDOW(section.registeredTerm.date)})
                        {section.registeredTerm.room && ` • ${section.registeredTerm.room}`}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <Button variant={section.status === 'registered' ? "ghost" : "default"} size="sm"
                        onClick={(e) => onOpenPicker(section, e.currentTarget)} disabled={isProcessing}
                        className={section.status === 'registered' ? "text-error hover:bg-error/10" : "bg-primary hover:bg-primary/90 text-primary-content"}>
                    {section.status === 'registered' ? 'Změnit' : 'Vyber datum'}
                </Button>
            </div>
        </div>
    );
}
