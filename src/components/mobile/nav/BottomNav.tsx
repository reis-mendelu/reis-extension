import { Calendar, CalendarCheck, Book, MapPin, User } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { MobileTab } from '../../../store/types';

// Order and membership are checked against MOBILE_TABS below, so this table
// and the store's list cannot drift apart.
const TABS: { id: MobileTab; icon: typeof Calendar; labelKey: string }[] = [
  { id: 'calendar', icon: Calendar, labelKey: 'mobile.nav.calendar' },
  { id: 'exams', icon: CalendarCheck, labelKey: 'mobile.nav.exams' },
  { id: 'subjects', icon: Book, labelKey: 'mobile.nav.subjects' },
  { id: 'map', icon: MapPin, labelKey: 'mobile.nav.map' },
  { id: 'profile', icon: User, labelKey: 'sidebar.profile' },
];

/**
 * Floating pill bar. Only the active tab shows its label, which is what keeps
 * the entries comfortable down to 375px.
 *
 * "Student" was a whole slot spent on a search field; search is a header action
 * now, and the slot went to the profile, which used to be a sheet behind the
 * header avatar.
 *
 * Below 360px the horizontal padding tightens: the widest active label
 * ("Předměty") pushes the pill to 325px, which overflows a 320px viewport
 * outright. Wider phones keep the roomier spacing.
 */
export function BottomNav() {
  const activeTab = useAppStore((s) => s.mobileTab);
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const keyboardOpen = useAppStore((s) => s.keyboardOpen);
  const { t } = useTranslation();

  if (keyboardOpen) return null;

  return (
    <nav
      aria-label={t('mobile.nav.label')}
      className="absolute bottom-[18px] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-base-300 bg-base-100 p-1.5 shadow-drawer max-[359px]:gap-0.5 max-[359px]:p-1"
    >
      {TABS.map(({ id, icon: Icon, labelKey }) => {
        const active = id === activeTab;
        return (
          <button
            key={id}
            aria-current={active ? 'page' : undefined}
            aria-label={t(labelKey)}
            onClick={() => setMobileTab(id)}
            className={`flex min-h-11 min-w-11 items-center gap-1.5 rounded-full px-3 transition-colors max-[359px]:px-2 ${
              active ? 'bg-primary/15 text-primary' : 'text-base-content/60'
            }`}
          >
            <Icon className="h-[19px] w-[19px]" />
            {active && <span className="text-sm font-semibold">{t(labelKey)}</span>}
          </button>
        );
      })}
    </nav>
  );
}
