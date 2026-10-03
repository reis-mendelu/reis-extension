import { Download, Loader2, Wifi } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { PasswordChip } from '../../Eduroam/PasswordChip';
import { EduroamCertNotices } from '../../Eduroam/EduroamExpiredNotice';
import { useEduroamSetup, type EduroamTarget } from '../../../hooks/data/useEduroamSetup';
import { useTranslation } from '../../../hooks/useTranslation';
import { isMac, isMobile } from '../../../utils/platform';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../../mobile/eduroamNative';
import { getPlatform } from '../../../platform';
import { EduroamSheetStatus } from './EduroamSheetStatus';

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
  const { status, password, error, outcome, expiredAt, expiresSoonAt, run, renew } =
    useEduroamSetup(target);
  const working = status === 'working';

  // On the phone itself Android saves the network directly, so there is no
  // profile to download, no QR to scan, and no password for anyone to type.
  // That collapses the flow from three steps to two.
  const native = canConfigureEduroamNatively(target);
  /**
   * reIS on a Mac: inside the app, but with no OS that will take the
   * configuration (see resolveNativeEduroamSupport). The student gets the same
   * profile a desktop browser would download, except it arrives through the
   * share sheet — so the flow gains a step the browser never needed, saying
   * what to do with the file once it is saved.
   */
  const macInApp = !native && target === 'mac' && getPlatform().kind === 'capacitor';

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader
        title={t('eduroam.heroTitle')}
        subtitle={t('eduroam.subtitle')}
        onClose={onClose}
      />
      <div className="flex flex-col gap-3.5 px-4 pb-6">
        <EduroamSheetStatus
          status={status}
          outcome={outcome}
          error={error}
          native={native}
          target={target}
        />

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
                : macInApp
                  ? t('eduroam.macApp.button')
                  : t('eduroam.download')}
          </button>
        </div>

        {/* Under the button the student just tapped: the certificate has expired,
            or will soon, and the way on is generating a new one. */}
        <EduroamCertNotices
          status={status}
          expiredAt={expiredAt}
          expiresSoonAt={expiresSoonAt}
          onRenew={() => void renew(target)}
          className="text-base"
        />

        {macInApp && (
          <div className="flex items-center gap-3">
            <NumberBadge n={3} />
            <span className="flex-1 text-sm text-base-content/70">
              {t('eduroam.macApp.installStep')}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <NumberBadge n={native ? 2 : macInApp ? 4 : 3} />
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
