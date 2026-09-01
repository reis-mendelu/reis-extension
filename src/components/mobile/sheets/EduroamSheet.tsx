import { Download, Loader2, AlertTriangle, Wifi, CheckCircle2 } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { PasswordChip } from '../../Eduroam/PasswordChip';
import { useEduroamSetup, type EduroamTarget } from '../../../hooks/data/useEduroamSetup';
import { useTranslation } from '../../../hooks/useTranslation';
import { isMac, isMobile } from '../../../utils/platform';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../../mobile/eduroamNative';

export interface EduroamSheetProps {
  onClose: () => void;
}

/** Which eduroam profile to hand the student — there's no device picker here
 *  (unlike the desktop drawer): the device running this sheet *is* the device
 *  being set up. Inside the app Capacitor says which OS that is; the user-agent
 *  guess is only for a browser, where a WKWebView could otherwise read as a Mac. */
function detectTarget(): EduroamTarget {
  const native = nativeEduroamTarget();
  if (native) return native;
  if (isMobile()) return isMac() ? 'ios' : 'android';
  return isMac() ? 'mac' : 'windows';
}

function NumberBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">
      {n}
    </span>
  );
}

/**
 * Container sheet for the eduroam flow (prototype lines 535-544): numbered rows
 * — certificate password, one-tap download for the detected device, and the
 * install/connect hint. All certificate/profile generation logic stays in
 * `useEduroamSetup` (shared with the desktop `EduroamDrawer`) — this sheet only
 * auto-picks the target and lays out the result.
 *
 * Inside the app (Android or iOS) the first row disappears: the OS saves the
 * network itself, so nothing is downloaded and no password is ever typed by a
 * human. Two steps instead of three.
 */
export function EduroamSheet({ onClose }: EduroamSheetProps) {
  const { t } = useTranslation();
  const target = detectTarget();
  const { status, password, qrDataUrl, error, outcome, run } = useEduroamSetup(target);
  const working = status === 'working';

  // On the phone itself Android saves the network directly, so there is no
  // profile to download, no QR to scan, and no password for anyone to type.
  // That collapses the flow from three steps to two.
  const native = canConfigureEduroamNatively(target);

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader
        title={t('eduroam.heroTitle')}
        subtitle={t('eduroam.subtitle')}
        onClose={onClose}
      />
      <div className="flex flex-col gap-3.5 px-4 pb-6">
        {status === 'error' && (
          <div className="alert alert-error text-base">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              {/* On the native path nothing is prepared or downloaded, so the
                  profile wording would describe a step that never happens —
                  including when the throw lands before Android is ever reached
                  (a lapsed IS session, a blip fetching the certificate) and
                  outcome is therefore still null. */}
              {native
                ? outcome === 'failed'
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

        {status === 'done' &&
          native &&
          (outcome === 'saved' || outcome === 'already-configured') && (
            <div className="alert alert-success text-base">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>
                {outcome === 'saved' ? t('eduroam.native.saved') : t('eduroam.native.already')}
              </span>
            </div>
          )}

        {!native && (
          <div className="flex items-center gap-3">
            <NumberBadge n={1} />
            <div className="min-w-0 flex-1">
              {password ? (
                <PasswordChip password={password} />
              ) : (
                <span className="text-base text-base-content/60">{t('eduroam.pwdLabel')}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <NumberBadge n={native ? 1 : 2} />
          <button
            type="button"
            onClick={() => run(target)}
            disabled={working}
            className="btn btn-primary flex-1 gap-2"
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : native ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {working
              ? native
                ? t('eduroam.native.working')
                : t('eduroam.preparing')
              : native
                ? t('eduroam.native.button')
                : t('eduroam.download')}
          </button>
        </div>

        {/* Never on the native path: the QR is a desktop→phone artifact and
            would be pointing this device at itself. */}
        {status === 'done' && qrDataUrl && !native && (
          <div className="ml-9 self-start rounded-box bg-white p-3">
            <img src={qrDataUrl} alt="eduroam QR" width={160} height={160} />
          </div>
        )}

        <div className="flex items-center gap-3">
          <NumberBadge n={native ? 2 : 3} />
          <span className="flex-1 text-sm text-base-content/70">{t('eduroam.connectStep')}</span>
        </div>

        {native && (
          <p className="ml-9 text-sm text-base-content/60">{t('eduroam.native.privacyNote')}</p>
        )}
        {/* iOS only: a network added through NEHotspotConfiguration is removed
            with the app. Android's saved network is the student's own and
            survives, so the sentence would be false there. */}
        {native && target === 'ios' && (
          <p className="ml-9 text-sm text-base-content/60">{t('eduroam.native.iosLifetime')}</p>
        )}
      </div>
    </Sheet>
  );
}
