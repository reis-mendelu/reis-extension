export function HeaderTabs({ activeTab, onTabChange }: any) {
    const tabs = [{ id: 'files', label: 'Soubory' }, { id: 'syllabus', label: 'Požadavky' }, { id: 'stats', label: 'Úspěšnost' }];
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
