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
    const tabs: { id: TabId; label: string }[] = [
        { id: 'files', label: t('course.tabs.files') },
        { id: 'classmates', label: t('course.tabs.classmates') },
        { id: 'osnovy', label: t('course.tabs.osnovy') },
        { id: 'stats', label: t('course.tabs.successRate') },
        { id: 'syllabus', label: t('course.tabs.requirements') },
    ];

    return (
        <div className="flex items-center gap-4 sm:gap-8 mt-4 overflow-x-auto scrollbar-none">
            {tabs.map(tab => {
                const isDisabled = disabledTabs.includes(tab.id);
                const count = counts?.[tab.id];
                return (
                    <button
                        key={tab.id}
                        onClick={() => !isDisabled && onTabChange(tab.id)}
                        disabled={isDisabled}
                        className={`text-xs sm:text-sm font-bold pb-2 border-b-2 transition-all px-1 flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                            isDisabled
                                ? 'border-transparent text-base-content/20 cursor-not-allowed'
                                : activeTab === tab.id
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-base-content/40 hover:text-base-content/60'
                        }`}
                    >
                        {tab.label}
                        {count !== undefined && (
                            <span className={`text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 ${
                                activeTab === tab.id
                                    ? 'bg-primary/15 text-primary'
                                    : 'bg-base-300 text-base-content/50'
                            }`}>
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
