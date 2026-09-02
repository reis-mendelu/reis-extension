import { motion, useReducedMotion } from 'motion/react';
import { Check, Wifi } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { EduroamStatus } from '../../hooks/data/useEduroamSetup';
import type { EduroamConfigOutcome } from '../../mobile/configureEduroam';
import type { NativeEduroamTarget } from '../../mobile/eduroamNative';

export interface WelcomeWifiCardProps {
  status: EduroamStatus;
  outcome: EduroamConfigOutcome | null;
  target: NativeEduroamTarget;
  onSetup: () => void;
}

/**
 * The hero of the first-run screen: one glyph, one line, one button. The
 * setup itself is `useEduroamSetup`'s native branch, verified on both phone
 * OSes — this card only lays its state out.
 *
 * Outlined glyph while idle, a pulse while the OS dialog is up, solid primary
 * with a check once the network is saved. Reduced motion keeps the state
 * change and drops the pulse.
 */
export function WelcomeWifiCard({ status, outcome, target, onSetup }: WelcomeWifiCardProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const working = status === 'working';
  const done = status === 'done' && (outcome === 'saved' || outcome === 'already-configured');
  // Any error lands here — a genuine `failed` from the OS, or a throw before
  // the OS was reached (lapsed session, cert fetch). One line either way.
  const failed = status === 'error';

  const line = done
    ? t('mobile.welcome.wifiDone')
    : failed
      ? t('mobile.welcome.wifiFailed')
      : t('mobile.welcome.wifiLine');

  return (
    <div className="flex flex-col items-center gap-4 rounded-box bg-base-100 p-6 text-center shadow-card">
      <motion.div
        aria-hidden
        className={`relative flex h-16 w-16 items-center justify-center rounded-full ${
          done ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/70'
        }`}
        animate={working && !reduced ? { scale: [1, 1.08, 1], opacity: [1, 0.55, 1] } : {}}
        transition={working && !reduced ? { duration: 1.2, repeat: Infinity } : { duration: 0.25 }}
      >
        <Wifi className="h-8 w-8" strokeWidth={done ? 2.5 : 2} />
        {done && (
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-base-100 text-primary shadow-card">
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
      </motion.div>

      <p className={`text-base font-medium ${failed ? 'text-error' : 'text-base-content'}`}>
        {line}
      </p>

      {/* What the tap does, while it is still on offer. Gone once done: the
          done line already says everything that is left to say. */}
      {!done && !failed && (
        <p className="text-sm text-base-content/70">{t('mobile.welcome.wifiBody')}</p>
      )}

      {!done && (
        <button
          type="button"
          onClick={onSetup}
          disabled={working}
          className="btn btn-primary w-full gap-2"
        >
          {working && <span className="loading loading-spinner loading-xs" />}
          {working ? t('eduroam.native.working') : t('eduroam.native.button')}
        </button>
      )}

      {/* iOS only, and only once it matters: a network added through
          NEHotspotConfiguration is removed with the app. Android's saved
          network is the student's own and survives. */}
      {done && target === 'ios' && (
        <p className="text-xs text-base-content/60">{t('eduroam.native.iosLifetime')}</p>
      )}
    </div>
  );
}
