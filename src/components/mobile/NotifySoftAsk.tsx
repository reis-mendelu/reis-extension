import { useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useVisibleMapEvents } from '../../hooks/useVisibleMapEvents';
import { useSociety } from '../../hooks/useSociety';
import { isSoonEvent } from '../CampusMap/eventWindow';
import { askNotificationPermission } from '../../services/eventReminders/sync';
import { pluralSuffix } from '../../services/eventReminders/digestText';

/**
 * The soft-ask card (phone/iPad tree only — see CLAUDE.md's tree-parity
 * rule; the desktop tree posts no notifications and has no use for this).
 *
 * Renders at the top of `MapEventsSection` and of `NotificationsSheet`, and
 * only when all hold: the OS permission is still askable (`prompt` or
 * `prompt-with-rationale`), the student has never answered this card before,
 * and at least one followed, unmuted society has a visible event starting in
 * the next 14 days (`isSoonEvent`). A denied/granted/unsupported/unread
 * permission, or `permissionAsked`, hides it — the card never returns once
 * answered.
 */
export function NotifySoftAsk() {
  const events = useVisibleMapEvents();
  const followed = useAppStore((s) => s.followed);
  const muted = useAppStore((s) => s.muted);
  const notifyPermission = useAppStore((s) => s.notifyPermission);
  const permissionAsked = useAppStore((s) => s.permissionAsked);
  const markPermissionAsked = useAppStore((s) => s.markPermissionAsked);
  const setNotifyPermission = useAppStore((s) => s.setNotifyPermission);
  const replanNotifications = useAppStore((s) => s.replanNotifications);
  const { t } = useTranslation();

  // Soon events per followed, unmuted society — the only thing that can make
  // the card worth showing.
  const perSociety = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (!followed.includes(e.societyId) || muted.includes(e.societyId)) continue;
      if (!isSoonEvent(e)) continue;
      counts.set(e.societyId, (counts.get(e.societyId) ?? 0) + 1);
    }
    return counts;
  }, [events, followed, muted]);

  const total = useMemo(
    () => [...perSociety.values()].reduce((sum, c) => sum + c, 0),
    [perSociety]
  );
  const soleSocietyId = perSociety.size === 1 ? [...perSociety.keys()][0]! : null;
  const soleSociety = useSociety(soleSocietyId);

  const canAsk = notifyPermission === 'prompt' || notifyPermission === 'prompt-with-rationale';
  if (!canAsk || permissionAsked || total === 0) return null;

  const suffix = pluralSuffix(total);
  const text = soleSocietyId
    ? t(`notify.askOne${suffix}`, { society: soleSociety?.shortName ?? soleSocietyId, n: total })
    : t(`notify.askMany${suffix}`, { n: total });

  const onEnable = async () => {
    const result = await askNotificationPermission();
    await markPermissionAsked();
    // Recorded whatever the answer: a refusal left the store on 'prompt', so
    // Profile kept offering a button the OS would ignore until the next
    // resume read. Only a grant gives the replan anything to schedule.
    setNotifyPermission(result);
    if (result === 'granted') replanNotifications();
  };

  const onNotNow = async () => {
    await markPermissionAsked();
  };

  return (
    <div className="card mb-3 border border-base-content/10 bg-base-200">
      <div className="card-body gap-3 p-3">
        <p className="text-sm text-base-content">{text}</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => void onNotNow()}>
            {t('notify.notNow')}
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void onEnable()}>
            {t('notify.enable')}
          </button>
        </div>
      </div>
    </div>
  );
}
