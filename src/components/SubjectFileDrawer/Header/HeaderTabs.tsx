import { FileText, Users, BarChart3, BookOpen, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

interface HeaderTabsProps {
    activeTab: string;
    onTabChange: (id: 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik') => void;
    disabledTabs?: string[];
    counts?: Record<string, number | undefined>;
}

export function HeaderTabs({ activeTab, onTabChange, disabledTabs = [], counts }: HeaderTabsProps) {
    const { t } = useTranslation();

    type TabId = 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik';
    const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
        { id: 'files', label: t('course.tabs.files'), icon: FileText },
        { id: 'classmates', label: t('course.tabs.classmates'), icon: Users },
        { id: 'stats', label: t('course.tabs.successRate'), icon: BarChart3 },
        { id: 'syllabus', label: t('course.tabs.requirements'), icon: BookOpen },
        { id: 'zaznamnik', label: t('course.tabs.zaznamnik'), icon: ClipboardList },
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
                            {tab.id !== 'zaznamnik' && count !== undefined && count > 0 && (
                                <span className={`absolute -top-1.5 -right-2 text-[9px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full px-0.5 ${
                                    isActive
                                        ? 'bg-primary text-primary-content'
                                        : 'bg-base-300 text-base-content/60'
                                }`}>
                                    {count}
                                </span>
                            )}
                            {tab.id === 'zaznamnik' && !isDisabled && count !== undefined && (
                                <span className={`absolute -top-0.5 -right-1.5 w-[7px] h-[7px] rounded-full border border-base-100 transition-colors ${
                                    count > 0 ? 'bg-success' : 'bg-base-content/20'
                                }`} />
                            )}
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold leading-tight text-center whitespace-nowrap">
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
