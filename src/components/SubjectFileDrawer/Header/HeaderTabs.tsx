import { FileText, Users, ClipboardCheck, BarChart3, BookOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface HeaderTabsProps {
    activeTab: string;
    onTabChange: (id: 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates' | 'osnovy') => void;
    disabledTabs?: string[];
    counts?: Record<string, number>;
}

export function HeaderTabs({ activeTab, onTabChange, disabledTabs = [], counts }: HeaderTabsProps) {
    const { t } = useTranslation();

    type TabId = 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates' | 'osnovy';
    const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
        { id: 'files', label: t('course.tabs.files'), icon: FileText },
        { id: 'classmates', label: t('course.tabs.classmates'), icon: Users },
        { id: 'osnovy', label: t('course.tabs.osnovy'), icon: ClipboardCheck },
        { id: 'stats', label: t('course.tabs.successRate'), icon: BarChart3 },
        { id: 'syllabus', label: t('course.tabs.requirements'), icon: BookOpen },
    ];

    return (
        <div className="flex items-center justify-between gap-1 mt-4">
            {tabs.map(tab => {
                const isDisabled = disabledTabs.includes(tab.id);
                const count = counts?.[tab.id];
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => !isDisabled && onTabChange(tab.id)}
                        disabled={isDisabled}
                        className={`flex-1 flex flex-col items-center gap-1 pb-2 border-b-2 transition-all group relative ${
                            isDisabled
                                ? 'border-transparent text-base-content/20 cursor-not-allowed'
                                : isActive
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-base-content/40 hover:text-base-content/60'
                        }`}
                    >
                        <div className="relative">
                            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                            {count !== undefined && count > 0 && (
                                <span className={`absolute -top-1.5 -right-2 text-[9px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-0.5 ${
                                    isActive
                                        ? 'bg-primary text-primary-content'
                                        : 'bg-base-300 text-base-content/60'
                                }`}>
                                    {count}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight text-center">
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
