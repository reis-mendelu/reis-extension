import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { syncService } from '../../../services/sync';

/**
 * Ask for fresh data now — the desktop `ExamsFreshness` circle, on a phone.
 *
 * Icon only, and that IS desktop parity rather than a reduction: desktop hides
 * its "aktualizováno před 3 hodinami" label behind `hidden md:inline`, so at
 * phone width the original is this button and nothing else.
 *
 * `triggerSync` is the `user` reason all the way down (mobile/actionHandler →
 * syncGate), which calls `resetSyncTtl()` and clears every freshness stamp. So
 * this is not a nudge that the 24h schedule TTL can swallow — it is the only
 * way a student who is looking at yesterday's timetable can get today's before
 * the next scheduled run.
 *
 * Its own copy, not `course.freshness.refresh`: that one reads "Obnovit
 * soubory" / "Refresh files", which is a lie on the calendar.
 *
 * The GLYPH is 12px and the HIT AREA is 44px, which is not a contradiction.
 * "A small rotate circle" is what it must look like; 44px is the touch minimum
 * this app already holds itself to — DayChips grew its arrows to h-11 for
 * exactly this reason ("the touch minimum the old 36px missed") and the header
 * actions are h-10. A btn-xs circle measures 24x24 on device, which would have
 * made this the smallest tap target in the app by a wide margin.
 *
 * `-my-2.5` hands the extra height back to the layout, so the row still
 * occupies the ~24px it did and the calendar keeps fitting without scrolling.
 * Measured on both screens at 320px: nothing interactive sits within 200px
 * above or below, so the overhang cannot steal a tap.
 *
 * `size={12}` and `text-base-content/50` are the desktop values, not a guess —
 * ExamsFreshness inherits the tint from its wrapping div and FilesFreshness
 * spells it out on the button. A brighter, larger circle was the first draft
 * and it read as a control demanding attention rather than one waiting to be
 * used.
 */
export function RefreshButton() {
  const { t } = useTranslation();
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);

  return (
    <button
      type="button"
      onClick={() => syncService.triggerSync()}
      disabled={isSyncing}
      title={t('mobile.header.refresh')}
      aria-label={t('mobile.header.refresh')}
      className="btn btn-ghost btn-circle interactive -my-2.5 h-11 min-h-11 w-11 text-base-content/50 disabled:opacity-50"
    >
      <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
    </button>
  );
}
