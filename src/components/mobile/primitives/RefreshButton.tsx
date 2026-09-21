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
      className="btn btn-ghost btn-xs btn-circle interactive disabled:opacity-50"
    >
      <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
    </button>
  );
}
