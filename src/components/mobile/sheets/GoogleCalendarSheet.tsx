import { useState } from 'react';
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
 * desktopHasNoGoogleCalendar.test.ts). Deleting the calendar takes a second
 * tap: it also removes past semesters, and nothing brings them back.
 */
export function GoogleCalendarSheet({ onClose }: GoogleCalendarSheetProps) {
  const { t } = useTranslation();
  const gcal = useAppStore((s) => s.gcal);
  const language = useAppStore((s) => s.language);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
            {confirmDelete ? (
              <div className="flex flex-col gap-2 rounded-box bg-base-200 p-3">
                <p className="text-sm">{t('mobile.gcal.offDeleteConfirm')}</p>
                <button
                  type="button"
                  className="btn btn-error"
                  onClick={() => void disconnectGoogleCalendar({ deleteCalendar: true })}
                >
                  {t('mobile.gcal.offDeleteYes')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  {t('common.back')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                // --tone-error, as on "Odhlásit se": plain text-error fails contrast in dark.
                className="btn btn-outline border-[var(--tone-error)] text-[var(--tone-error)]"
                onClick={() => setConfirmDelete(true)}
              >
                {t('mobile.gcal.offDelete')}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void disconnectGoogleCalendar({ deleteCalendar: false })}
            >
              {t('mobile.gcal.offKeep')}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
