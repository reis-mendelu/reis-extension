import { FileText, Users, BarChart3, BookOpen, ClipboardList } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import type { DrawerTab } from '../../SubjectFileDrawer/types';

const TABS: { id: DrawerTab; labelKey: string; icon: LucideIcon }[] = [
    { id: 'files', labelKey: 'course.tabs.files', icon: FileText },
    { id: 'classmates', labelKey: 'course.tabs.classmates', icon: Users },
    { id: 'stats', labelKey: 'course.tabs.successRate', icon: BarChart3 },
    { id: 'syllabus', labelKey: 'course.tabs.requirements', icon: BookOpen },
    { id: 'zaznamnik', labelKey: 'course.tabs.zaznamnik', icon: ClipboardList },
];

interface SubjectDrawerTabsProps {
    activeTab: DrawerTab;
    onTabChange: (tab: DrawerTab) => void;
    disabledTabs: DrawerTab[];
    counts: Partial<Record<DrawerTab, number | undefined>>;
}

/**
 * The five icon tabs beneath the subject drawer header — prototype lines
 * 334–368. A touch-sized (vertical icon + label + badge) equivalent of
 * desktop's `HeaderTabs`, which is text-and-underline and assumes mouse
 * hover; not reused directly for that reason.
 */
export function SubjectDrawerTabs({ activeTab, onTabChange, disabledTabs, counts }: SubjectDrawerTabsProps) {
    const { t } = useTranslation();

    return (
        // Below 360px the five labels no longer fit a fifth of the width each
        // — the longest ("Záznámník") pushed the row to 325px on a 320px
        // screen and clipped itself. Tighter padding and a hair smaller label
        // keep all five visible; wider phones are unaffected.
        <div className="flex flex-shrink-0 items-end gap-0.5 border-b border-base-300 px-2 max-[359px]:gap-0 max-[359px]:px-1">
            {TABS.map(({ id, labelKey, icon: Icon }) => {
                const isActive = activeTab === id;
                const isDisabled = disabledTabs.includes(id);
                const count = counts[id];

                return (
                    <button
                        key={id}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => onTabChange(id)}
                        className={`flex min-h-11 flex-1 flex-col items-center gap-1 border-b-2 pb-2 pt-2.5 ${
                            isDisabled
                                ? 'border-transparent text-base-content/20'
                                : isActive
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-base-content/40'
                        }`}
                    >
                        <span className="relative">
                            <Icon size={17} strokeWidth={isActive ? 2.5 : 2} />
                            {count !== undefined && count > 0 && (
                                // Neutral, not primary: a solid green pill on every
                                // tab competed with the active-tab underline for
                                // attention. The prototype's badge is 9px and
                                // base-300 (it tints only the active tab's); this
                                // stays neutral throughout so the count informs
                                // without shouting.
                                <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-base-300 px-1 text-[9px] font-bold text-base-content/70">
                                    {count}
                                </span>
                            )}
                        </span>
                        <span className="text-xs font-bold leading-tight max-[359px]:text-[11px]">{t(labelKey)}</span>
                    </button>
                );
            })}
        </div>
    );
}
