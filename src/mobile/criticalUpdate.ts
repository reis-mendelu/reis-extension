import { fetchCriticalVersion } from '../api/criticalVersion';
import { trackFeatureSignal } from '../api/featureUsage';
import { CRITICAL_POPUP_KEY, IndexedDBService } from '../services/storage/IndexedDBService';
import { useAppStore } from '../store/useAppStore';
import { getAppVersion } from '../utils/appIdentity';
import type { StoreUpdateInfo } from '../utils/appUpdateOffer';
import {
  criticalUpdateApplies,
  dayKey,
  nextPopupLog,
  shouldShowCriticalPopup,
  type PopupLog,
} from '../utils/criticalUpdate';
import { logError } from '../utils/reportError';

/**
 * The phone's half of the critical-version pop-up. Called by
 * mobile/appUpdate's check (boot and resume) with what the store said; the
 * rules are utils/criticalUpdate, the pop-up CriticalUpdateDialog, the
 * empty-screen hint CriticalUpdateHint.
 */
export async function applyCriticalUpdate(
  info: StoreUpdateInfo,
  os: 'ios' | 'android',
  osVersion: string | null = null,
  now: Date = new Date()
): Promise<void> {
  const critical = await fetchCriticalVersion();
  const applies = criticalUpdateApplies(getAppVersion(), critical, info, os, now, osVersion);
  const store = useAppStore.getState();
  store.setCriticalUpdate(applies ? critical : null);
  if (!applies || !critical) return;

  try {
    const log = ((await IndexedDBService.get('meta', CRITICAL_POPUP_KEY)) ??
      null) as PopupLog | null;
    const today = dayKey(now);
    if (!shouldShowCriticalPopup(log, critical.minVersion, today)) return;
    // Recorded before it opens: a crash while it is up still counts as shown.
    await IndexedDBService.set(
      'meta',
      CRITICAL_POPUP_KEY,
      nextPopupLog(log, critical.minVersion, today)
    );
  } catch (err) {
    // No record means no limit, and an unlimited pop-up is the one thing it must not be.
    logError('Mobile.criticalUpdate.log', err);
    return;
  }
  store.openCriticalPopup();
  void trackFeatureSignal('critical_update_shown');
}
