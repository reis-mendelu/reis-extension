import { CalendarSync, Loader2 } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
} from '../../../mobile/googleCalendar/controller';
import { openExternal } from '../../../mobile/openExternal';
import { syncTimeLabel } from '../../../mobile/googleCalendar/syncTimeLabel';

export interface GoogleCalendarSheetProps {
  onClose: () => void;
}

const NOTICE_KEY = {
  revoked: 'mobile.gcal.revoked',
  calendarGone: 'mobile.gcal.gone',
  failed: 'mobile.gcal.failed',
  scopeMissing: 'mobile.gcal.scopeMissing',
} as const;

/**
 * Turns the "Rozvrh" sync on and off (phone/iPad only; see
 * desktopHasNoGoogleCalendar.test.ts). On and off only — no "delete the
 * calendar" (Dominik, 2026-10-08): turning off keeps "Rozvrh" in Google.
 */
export function GoogleCalendarSheet({ onClose }: GoogleCalendarSheetProps) {
  const { t } = useTranslation();
  const gcal = useAppStore((s) => s.gcal);
  const language = useAppStore((s) => s.language);
  const time = syncTimeLabel(gcal.lastSyncAt, language);

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('mobile.gcal.row')} onClose={onClose} />
      <div className="flex flex-col gap-3 px-4 pb-6">
        {gcal.notice && <p className="text-sm text-warning">{t(NOTICE_KEY[gcal.notice])}</p>}
        {!gcal.connected ? (
          <>
            <p className="text-sm text-base-content/70">{t('mobile.gcal.explain')}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void connectGoogleCalendar()}
            >
              <CalendarSync size={16} /> {t('mobile.gcal.connect')}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm">
              {gcal.syncing && gcal.progress
                ? t('mobile.gcal.progress', {
                    done: gcal.progress.done,
                    total: gcal.progress.total,
                  })
                : time && t('mobile.gcal.rowOn', { time })}
              {gcal.syncing && <Loader2 size={14} className="ml-2 inline animate-spin" />}
            </p>
            {gcal.syncing && gcal.progress && (
              <p className="text-xs text-base-content/70">{t('mobile.gcal.progressHint')}</p>
            )}
            {gcal.email && (
              <p className="text-xs text-base-content/70">
                {t('mobile.gcal.account', { email: gcal.email })}
              </p>
            )}
            <button
              type="button"
              className="btn btn-ghost justify-start"
              onClick={() => void openExternal('https://calendar.google.com/')}
            >
              {t('mobile.gcal.open')}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => void disconnectGoogleCalendar()}
            >
              {t('mobile.gcal.off')}
            </button>
            <p className="text-xs text-base-content/70">{t('mobile.gcal.offHint')}</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
