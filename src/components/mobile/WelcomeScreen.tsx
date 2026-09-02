import { ReisLogo } from '../ReisLogo';
import { WelcomeWifiCard } from './WelcomeWifiCard';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEduroamSetup } from '../../hooks/data/useEduroamSetup';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../mobile/eduroamNative';
import { logError } from '../../utils/reportError';

/**
 * First-run screen of the phone UI, owned by `MobileApp` while
 * `welcomeSeen === false` — the same gate model `LoginGate` has before login.
 *
 * One screen, two choices: the language, and one tap that sets eduroam up
 * natively before the student has seen the calendar. Campus Wi-Fi is the
 * feature a new student needs on day one, and in the profile sheet most never
 * found it (#191).
 *
 * Deliberately sparse: a title, one card line, one button, one exit. The
 * language toggle is `CZ | EN`, not translated words — a control you may need
 * before you can read the screen has to be legible in either language.
 */
export function WelcomeScreen() {
  const { t, language } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const dismissWelcome = useAppStore((s) => s.dismissWelcome);

  // Inside the app Capacitor names the OS; off it (the web dev host) there is
  // no native path, so the card is not offered and the hook stays idle.
  const target = nativeEduroamTarget();
  const native = target !== null && canConfigureEduroamNatively(target);
  const { status, outcome, run } = useEduroamSetup(target ?? undefined);

  const done = status === 'done' && (outcome === 'saved' || outcome === 'already-configured');
  const failed = status === 'error';

  const dismiss = () => {
    void dismissWelcome().catch((e) => logError('WelcomeScreen.dismiss', e));
  };

  // The footer is the one thing that changes meaning: while eduroam is on
  // offer it is a quiet exit; once eduroam is done (or cannot be offered) it
  // is the way forward; after a failure it says so honestly and still moves on.
  const footer =
    done || !native
      ? { label: t('onboarding.getStarted'), primary: true }
      : failed
        ? { label: t('mobile.welcome.continue'), primary: true }
        : { label: t('mobile.welcome.notNow'), primary: false };

  return (
    // Safe-area padding on both ends: this is a full screen, drawn under the
    // status bar on top and the home indicator at the bottom.
    <div className="flex min-h-dvh flex-col bg-base-200 px-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom,0px))] pt-[calc(1.5rem_+_var(--safe-top,0px))] text-base-content">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
          <ReisLogo className="h-10 w-10" />
          <div className="join">
            <button
              type="button"
              onClick={() => setLanguage('cz')}
              className={`join-item btn btn-xs w-12 ${language === 'cz' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
            >
              CZ
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`join-item btn btn-xs w-12 ${language === 'en' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
            >
              EN
            </button>
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t('mobile.welcome.title')}
        </h1>

        <div className="flex flex-1 items-center">
          {native && target && (
            <div className="w-full">
              <WelcomeWifiCard
                status={status}
                outcome={outcome}
                target={target}
                onSetup={() => void run(target)}
              />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          className={`btn w-full ${footer.primary ? 'btn-primary' : 'btn-ghost'}`}
        >
          {footer.label}
        </button>
      </div>
    </div>
  );
}
