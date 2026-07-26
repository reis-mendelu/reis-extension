import { Calendar, CalendarCheck, Book, MapPin, User } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { MobileTab } from '../../../store/types';

const TABS: { id: MobileTab; icon: typeof Calendar; labelKey: string }[] = [
    { id: 'calendar', icon: Calendar, labelKey: 'mobile.nav.calendar' },
    { id: 'exams', icon: CalendarCheck, labelKey: 'mobile.nav.exams' },
    { id: 'subjects', icon: Book, labelKey: 'mobile.nav.subjects' },
    { id: 'map', icon: MapPin, labelKey: 'mobile.nav.map' },
    { id: 'student', icon: User, labelKey: 'mobile.nav.student' },
];

/**
 * Floating pill bar. Only the active tab shows its label, which is what keeps
 * five entries comfortable down to 375px.
 */
export function BottomNav() {
    const activeTab = useAppStore((s) => s.mobileTab);
    const setMobileTab = useAppStore((s) => s.setMobileTab);
    const keyboardOpen = useAppStore((s) => s.keyboardOpen);
    const { t } = useTranslation();

    if (keyboardOpen) return null;

    return (
        <div
            role="tablist"
            className="absolute bottom-[18px] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-base-300 bg-base-100 p-1.5 shadow-drawer"
        >
            {TABS.map(({ id, icon: Icon, labelKey }) => {
                const active = id === activeTab;
                return (
                    <button
                        key={id}
                        role="tab"
                        aria-selected={active}
                        aria-label={t(labelKey)}
                        onClick={() => setMobileTab(id)}
                        className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors ${
                            active ? 'bg-primary/15 text-primary' : 'text-content-muted'
                        }`}
                    >
                        <Icon className="h-[19px] w-[19px]" />
                        {active && <span className="text-xs font-semibold">{t(labelKey)}</span>}
                    </button>
                );
            })}
        </div>
    );
}
