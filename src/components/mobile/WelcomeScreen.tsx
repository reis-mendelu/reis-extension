import { ReisLogo } from '../ReisLogo';
import { WelcomeWifiCard } from './WelcomeWifiCard';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEduroamSetup } from '../../hooks/data/useEduroamSetup';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../mobile/eduroamNative';
import { logError } from '../../utils/reportError';
import { isEduroamConfigured } from '../../mobile/configureEduroam';

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
 *
 * **On a tablet the screen does not grow — the frame does.** The app ships the
 * phone tree on iPad (`resolvePhoneViewport`), and at 1024pt the phone's
 * full-bleed column read as six strings adrift in an empty screen. The first
 * attempt at a fix was a full-bleed two-pane split, which turned one void into
 * two: no arrangement of six strings fills 1024×1366, and the ambient graphic
 * covering the difference was decoration standing in for content. So at `md`
 * and up the same column becomes a centred dialog sized to what it holds, and
 * the space around it is margin rather than a gap to be filled.
 *
 * One DOM tree, `md:` utilities only: below 768px this is the screen verified
 * on the iPad and on the handset, unchanged.
 */
export function WelcomeScreen() {
  const { t, language } = useTranslation();
  const setLanguage = useAppStore((s) => s.setLanguage);
  const dismissWelcome = useAppStore((s) => s.dismissWelcome);

  // Inside the app Capacitor names the OS; off it (the web dev host) there is
  // no native path, so the card is not offered and the hook stays idle.
  // `?eduroam=ios` forces the gate on the dev webapp — see `eduroamNative`.
  const target = nativeEduroamTarget();
  const native = target !== null && canConfigureEduroamNatively(target);
  const { status, outcome, run } = useEduroamSetup(target ?? undefined);

  const done = status === 'done' && isEduroamConfigured(outcome);
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
    // status bar on top and the home indicator at the bottom. Centring at `md`
    // is `justify-center` on the same flex column, so the phone's top-anchored
    // flow is untouched.
    <div className="flex min-h-dvh flex-col bg-base-200 px-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom,0px))] pt-[calc(1.5rem_+_var(--safe-top,0px))] text-base-content md:items-center md:justify-center md:px-8">
      {/* The column below `md`, the dialog above it. `md:flex-none` hands the
          height back so the box wraps its content instead of the viewport,
          which is what makes the space around it read as margin. The hairline
          is not trim: `base-100` on `base-200` is 1.03:1 in the light theme,
          so without it the dialog has no edge there at all. */}
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 md:max-w-2xl md:flex-none md:gap-8 md:rounded-box md:border md:border-base-content/10 md:bg-base-100 md:p-10 md:shadow-popup">
        <div className="flex items-center justify-between">
          <ReisLogo className="h-10 w-10 md:h-11 md:w-11" />
          <div className="join">
            <button
              type="button"
              onClick={() => setLanguage('cz')}
              className={`join-item btn btn-xs w-12 md:btn-sm md:w-16 ${language === 'cz' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
            >
              CZ
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`join-item btn btn-xs w-12 md:btn-sm md:w-16 ${language === 'en' ? 'btn-primary' : 'btn-ghost opacity-60'}`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {t('mobile.welcome.title')}
          </h1>
          {/* The desktop modal's one-liner, reused: it is the same product
              and already says who built it and why. `\n` in the string
              becomes the line break it was written for. */}
          <p className="whitespace-pre-line text-base text-base-content/70 md:text-lg">
            {t('onboarding.description')}
          </p>
        </div>

        {/* `flex-1` centres the card in whatever height a phone screen has
            left over. A dialog has no leftover height, so it goes away. */}
        <div className="flex flex-1 items-center md:flex-none">
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
          className={`btn w-full md:w-auto md:self-end md:px-10 ${footer.primary ? 'btn-primary' : 'btn-ghost'}`}
        >
          {footer.label}
        </button>
      </div>
    </div>
  );
}
