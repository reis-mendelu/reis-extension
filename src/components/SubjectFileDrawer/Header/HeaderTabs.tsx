import { useTranslation } from '../../../hooks/useTranslation';

interface HeaderTabsProps {
    activeTab: string;
    onTabChange: (id: any) => void;
    disabledTabs?: string[];
}

export function HeaderTabs({ activeTab, onTabChange, disabledTabs = [] }: HeaderTabsProps) {
    const { t } = useTranslation();
    const label = t('course.tabs.classmates');
    const displayLabel = label === 'course.tabs.classmates' ? 'Spolužáci' : label;

    const tabs = [
        { id: 'files', label: t('course.tabs.files') }, 
        { id: 'syllabus', label: t('course.tabs.requirements') }, 
        { id: 'stats', label: t('course.tabs.successRate') },
        { id: 'classmates', label: displayLabel }
    ];

    return (
        <div className="flex items-center gap-8 mt-4">
            {tabs.map(tab => {
                const isDisabled = disabledTabs.includes(tab.id);
                return (
                    <button 
                        key={tab.id} 
                        onClick={() => !isDisabled && onTabChange(tab.id)}
                        disabled={isDisabled}
                        className={`text-sm font-bold pb-2 border-b-2 transition-all px-1 ${
                            isDisabled 
                                ? 'border-transparent text-base-content/20 cursor-not-allowed' 
                                : activeTab === tab.id 
                                    ? 'border-primary text-primary' 
                                    : 'border-transparent text-base-content/40 hover:text-base-content/60'
                        }`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
