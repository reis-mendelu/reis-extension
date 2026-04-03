import { Plus, X, Timer, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { Button } from '../../ui/button';
import { 
    DropdownMenu, 
    DropdownMenuTrigger, 
    DropdownMenuContent, 
    DropdownMenuRadioGroup, 
    DropdownMenuRadioItem 
} from '../../ui/dropdown-menu';

export function SubjectTimeline({ courseCode }: { courseCode: string }) {
    const { t } = useTranslation();
    const courseDeadlines = useAppStore(s => s.courseDeadlines);
    const setCourseDeadlines = useAppStore(s => s.setCourseDeadlines);
    const teachingWeekData = useAppStore(s => s.teachingWeekData);
    const totalWeeks = teachingWeekData?.total || 13;
    const deadlines = courseDeadlines[courseCode] || [];

    const [labelKey, setLabelKey] = useState('exam');
    const [week, setWeek] = useState(11);

    const handleAdd = () => {
        const newDeadlines = [...deadlines, { week, label: t(`timeline.${labelKey}`) }];
        newDeadlines.sort((a, b) => a.week - b.week);
        setCourseDeadlines(courseCode, newDeadlines);
    };

    const handleRemove = (index: number) => {
        const newDeadlines = [...deadlines];
        newDeadlines.splice(index, 1);
        setCourseDeadlines(courseCode, newDeadlines);
    };

    const labelOptions = ['exam', 'assessment', 'project', 'other'];

    return (
        <div className="space-y-4 pt-1 pb-4">
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider opacity-90">
                <Timer size={14} className="mt-[-2px]"/>
                <span>{t('timeline.title')}</span>
            </div>
            <p className="text-xs text-base-content/50 leading-relaxed mb-4 max-w-md">
                {t('timeline.description')}
            </p>

            <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
                    <span className="text-[10px] uppercase font-bold text-base-content/30 ml-1">{t('timeline.type')}</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="btn btn-sm btn-ghost border border-base-300 w-full justify-between font-normal px-3 bg-base-100 focus:outline-none focus:ring-0">
                                <span className="truncate">{t(`timeline.${labelKey}`)}</span>
                                <ChevronDown size={14} className="opacity-50 shrink-0" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-48 max-h-60 overflow-y-auto">
                            <DropdownMenuRadioGroup value={labelKey} onValueChange={setLabelKey}>
                                {labelOptions.map(opt => (
                                    <DropdownMenuRadioItem key={opt} value={opt}>
                                        <span className="text-[13px] font-medium">{t(`timeline.${opt}`)}</span>
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="flex flex-col gap-1.5 w-28">
                    <span className="text-[10px] uppercase font-bold text-base-content/30 ml-1">{t('timeline.week')}</span>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="btn btn-sm btn-ghost border border-base-300 w-full justify-between font-normal px-3 bg-base-100 focus:outline-none focus:ring-0">
                                <span className="truncate">{t('timeline.weekLabel', { count: week })}</span>
                                <ChevronDown size={14} className="opacity-50 shrink-0" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32 max-h-60 overflow-y-auto">
                            <DropdownMenuRadioGroup value={week.toString()} onValueChange={val => setWeek(parseInt(val))}>
                                {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => (
                                    <DropdownMenuRadioItem key={w} value={w.toString()}>
                                        <span className="text-[13px] font-medium">{t('timeline.weekLabel', { count: w })}</span>
                                    </DropdownMenuRadioItem>
                                ))}
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <Button 
                    size="sm"
                    onClick={handleAdd}
                    className="h-8 w-8 p-0 shrink-0 border-none"
                    disabled={deadlines.some(d => d.week === week && d.label === t(`timeline.${labelKey}`))}
                >
                    <Plus size={16} />
                </Button>
            </div>

            {deadlines.length > 0 && (
                <div className="grid grid-cols-1 gap-2 pt-1">
                    {deadlines.map((d, i) => (
                        <div key={i} className="flex items-center justify-between bg-base-200/40 px-3 py-2 rounded-lg group text-sm border border-transparent hover:border-base-300 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="text-center font-bold text-primary text-[10px] bg-primary/10 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    {t('timeline.weekLabel', { count: d.week })}
                                </div>
                                <span className="font-medium text-base-content/80 text-[13px]">{d.label}</span>
                            </div>
                            <Button 
                                variant="ghost"
                                onClick={() => handleRemove(i)}
                                className="h-6 w-6 p-0 hover:bg-error/10 hover:text-error text-base-content/20 transition-colors"
                            >
                                <X size={14} />
                            </Button>
                        </div>
                    ))}
                </div>
            )}
            
            <div className="border-b border-base-200 w-full pt-2 opacity-50" />
        </div>
    );
}
