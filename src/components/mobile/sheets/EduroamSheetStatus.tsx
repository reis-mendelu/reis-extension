import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { EduroamStatus, EduroamTarget } from '../../../hooks/data/useEduroamSetup';
import { useTranslation } from '../../../hooks/useTranslation';
import { isEduroamConfigured, type EduroamConfigOutcome } from '../../../mobile/configureEduroam';

export interface EduroamSheetStatusProps {
  status: EduroamStatus;
  outcome: EduroamConfigOutcome | null;
  error: string | null;
  native: boolean;
  target: EduroamTarget;
}

/**
 * What the last run of `useEduroamSetup` came to, as the eduroam sheet shows
 * it: an error or warning, the dismissed-dialog note, or the success banner.
 * Split out of `EduroamSheet` to keep that file under the 200-line convention.
 */
export function EduroamSheetStatus({
  status,
  outcome,
  error,
  native,
  target,
}: EduroamSheetStatusProps) {
  const { t } = useTranslation();
  // Warnings, not errors: nothing broke, the student has one thing to do.
  // `stale-association` (#261) — on eduroam with nothing of ours behind it;
  // `renewal-blocked` — on eduroam, so iOS kept the old certificate.
  const warning = outcome === 'stale-association' || outcome === 'renewal-blocked';

  return (
    <>
      {status === 'error' && (
        <div className={`alert text-base ${warning ? 'alert-warning' : 'alert-error'}`}>
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>
            {/* On the native path nothing is prepared or downloaded, so the
                profile wording would describe a step that never happens —
                including when the throw lands before Android is ever reached
                (a lapsed IS session, a blip fetching the certificate) and
                outcome is therefore still null. */}
            {native
              ? outcome === 'stale-association'
                ? t('eduroam.native.staleAssociation')
                : outcome === 'renewal-blocked'
                  ? t('eduroam.native.renewalBlocked')
                  : outcome === 'failed'
                    ? t('eduroam.native.failed')
                    : `${t('eduroam.native.error')}${error ? `: ${error}` : ''}`
              : `${t('eduroam.error')}${error ? `: ${error}` : ''}`}
          </span>
        </div>
      )}

      {native && outcome === 'cancelled' && (
        <div className="alert alert-info text-base">
          <span>{t('eduroam.native.cancelled')}</span>
        </div>
      )}

      {status === 'done' && native && isEduroamConfigured(outcome) && (
        /* items-start, not the alert's default centring: this block is two
           lines of different weight now, and a centred icon floats against
           the middle of the paragraph instead of sitting with the headline
           it belongs to. */
        <div className="alert alert-success items-start text-base">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="font-semibold">
              {outcome === 'already-configured'
                ? t('eduroam.native.already')
                : t('eduroam.native.saved')}
            </span>
            {/* The note is why this block has a hierarchy at all.
                `apply` SAVES and ASSOCIATES in one call, and out of range iOS
                raises its OWN "Unable to join the network eduroam" alert —
                seen on the device over this very banner. No API suppresses
                it: there is no save-without-join. And it cannot be predicted
                from the outcome either, because the device that showed it
                reported plain `saved` with no error at all.
                So the note is shown for every fresh save, hedged with "může"
                so it stays true on campus, where the alert never appears. Not
                for `already-configured`: nothing was applied, so iOS says
                nothing. */}
            {outcome !== 'already-configured' && (
              <span className="text-sm opacity-90">{t('eduroam.native.savedNote')}</span>
            )}
            {/* iOS only. The build before this one swapped keychain items
                under a live configuration (see EduroamPlugin.swift), so a
                device can hold an eduroam setup whose references are dead —
                and nothing on iOS can tell it from a healthy one. The line
                must not vouch for it. Android's ALREADY_EXISTS is the
                student's own saved network, so no hint there. */}
            {outcome === 'already-configured' && target === 'ios' && (
              <span className="text-sm opacity-90">{t('eduroam.native.alreadyIosNote')}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
