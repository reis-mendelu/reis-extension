import { useTranslation } from '../../../hooks/useTranslation';

interface HeaderTabsProps {
    activeTab: string;
    onTabChange: (id: any) => void;
}

export function HeaderTabs({ activeTab, onTabChange }: HeaderTabsProps) {
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
            {tabs.map(tab => (
                <button key={tab.id} onClick={() => onTabChange(tab.id)}
                        className={`text-sm font-bold pb-2 border-b-2 transition-all px-1 ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content/60'}`}>
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
