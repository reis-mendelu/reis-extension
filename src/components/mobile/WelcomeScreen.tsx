import { ReisLogo } from '../ReisLogo';
import { WelcomeSignal } from './WelcomeSignal';
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
 *
 * Two compositions, one DOM tree. Below `md` it is the phone screen verified on
 * device: a centred `max-w-sm` column. At `md` and up it is a full-bleed split —
 * identity on the left under the signal rings, the action on a raised pane on
 * the right. The app ships the phone tree on iPad (see `resolvePhoneViewport`),
 * where the centred column left two thirds of a 1024pt screen empty.
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

  // The split is gated on the card, not on width: with no card the right pane
  // would be a full-height empty surface holding one button, which is worse at
  // 1024pt than the centred column. In production the two conditions coincide —
  // the phone tree only reaches `md` widths inside the Capacitor app, which is
  // exactly where the native card exists.
  const split = native && target !== null;

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
    // status bar on top and the home indicator at the bottom. The panes carry
    // it rather than the page, so each half can run edge to edge.
    <div
      className={`flex min-h-dvh flex-col bg-base-200 text-base-content ${
        split ? 'md:grid md:grid-cols-[1fr_minmax(22rem,0.8fr)]' : ''
      }`}
    >
      <section
        className={`relative flex flex-col gap-6 overflow-hidden px-6 pt-[calc(1.5rem_+_var(--safe-top,0px))] ${
          split ? 'md:px-12 md:pb-14 md:pt-[calc(3rem_+_var(--safe-top,0px))]' : ''
        }`}
      >
        <div className="mx-auto flex w-full max-w-sm items-center justify-between md:mx-0 md:max-w-none">
          {/* `relative` is the signal's anchor: the rings are centred on the
              green dot in the mark, so they scale with the logo. */}
          <div className="relative">
            <ReisLogo className="h-10 w-10 md:h-12 md:w-12" />
            {split && <WelcomeSignal />}
          </div>
          <div className="join relative">
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

        {/* `mt-auto` only bites once the pane is a full-height grid cell: on the
            phone this block stays directly under the logo row, on a tablet it
            drops to the foot of the pane and reads as a poster. */}
        <div
          className={`mx-auto flex w-full max-w-sm flex-col gap-2 ${
            split ? 'md:mx-0 md:mt-auto md:max-w-lg md:gap-4' : ''
          }`}
        >
          <h1
            className={`font-display text-3xl font-bold tracking-tight ${
              split ? 'md:text-6xl md:leading-[1.05]' : ''
            }`}
          >
            {t('mobile.welcome.title')}
          </h1>
          {/* The desktop modal's one-liner, reused: it is the same product
              and already says who built it and why. `\n` in the string
              becomes the line break it was written for. */}
          <p
            className={`whitespace-pre-line text-base text-base-content/70 ${
              split ? 'md:text-lg' : ''
            }`}
          >
            {t('onboarding.description')}
          </p>
        </div>
      </section>

      {/* The action pane. Raised in the dark theme, where base-100 lifts off
          base-200; in the light theme those two are 1.03:1, so the hairline is
          what actually draws the seam. */}
      <section
        className={`flex flex-1 flex-col px-6 pb-[calc(1.5rem_+_env(safe-area-inset-bottom,0px))] ${
          split
            ? 'md:justify-center md:border-l md:border-base-content/10 md:bg-base-100 md:px-12 md:pt-[calc(3rem_+_var(--safe-top,0px))]'
            : ''
        }`}
      >
        <div
          className={`mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 ${
            split ? 'md:max-w-md md:flex-none md:gap-8' : ''
          }`}
        >
          <div className={`flex flex-1 items-center ${split ? 'md:flex-none' : ''}`}>
            {split && target && (
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
            className={`btn w-full ${footer.primary ? 'btn-primary' : 'btn-ghost'} ${
              split ? 'md:btn-lg' : ''
            }`}
          >
            {footer.label}
          </button>
        </div>
      </section>
    </div>
  );
}
