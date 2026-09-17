import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi } from 'lucide-react';
import { ReisLogo } from '../ReisLogo';
import { IndexedDBService } from '../../services/storage';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { desktopEduroamTarget } from '../../utils/desktopEduroamTarget';
import { logError } from '../../utils/reportError';

/**
 * First run on the desktop, and eduroam is what it is for.
 *
 * The phone screen (`WelcomeScreen`) makes campus Wi-Fi the first thing a new
 * student sees, because it is the thing they need on day one and almost
 * nobody found it buried in a menu (#191). This is that screen's desktop
 * twin — same gate (`meta.welcome_dismissed`, unchanged, so nobody who has
 * dismissed it meets it again), same shape: a line, one button, one exit.
 *
 * Two honest differences from the phone. The device is resolved here rather
 * than asked — reIS is running on the machine being set up — so the drawer's
 * picker is skipped on the two desktops it has manuals for, and kept on the
 * ones it does not. And the button starts the setup
 * instead of finishing it: there is no native path in a browser, so Windows
 * still means the geteduroam wizard and a Mac still means installing a
 * profile. The steps stay in `EduroamDrawer`, which this hands off to — the
 * modal is `max-h-[90dvh]` and five numbered screenshots do not belong in it.
 */
export function WelcomeModal() {
  const [isVisible, setIsVisible] = useState(false);
  const { t, language } = useTranslation();
  const setLanguage = useAppStore((state) => state.setLanguage);
  const openEduroamFor = useAppStore((state) => state.openEduroamFor);
  const setIsEduroamOpen = useAppStore((state) => state.setIsEduroamOpen);

  useEffect(() => {
    async function checkWelcome() {
      try {
        const dismissed = await IndexedDBService.get('meta', 'welcome_dismissed');
        if (!dismissed) {
          const timer = setTimeout(() => setIsVisible(true), 800);
          return () => clearTimeout(timer);
        }
      } catch (err) {
        logError('WelcomeModal.checkStatus', err);
      }
    }
    checkWelcome();
  }, []);

  const dismiss = () => {
    setIsVisible(false);
    IndexedDBService.set('meta', 'welcome_dismissed', true).catch((e) =>
      logError('WelcomeModal.dismiss', e)
    );
  };

  const startEduroam = () => {
    dismiss();
    // Null is a Linux or ChromeOS desktop, which reIS has no manual for: open
    // the drawer on its own device picker rather than handing that student the
    // geteduroam wizard for a machine they are not sitting at.
    const target = desktopEduroamTarget();
    if (target) openEduroamFor(target);
    else setIsEduroamOpen(true);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[calc(100%-2rem)] max-w-sm sm:max-w-lg"
          >
            {/* The marker `verify:ui --onboarding` waits for: the modal is
                shown 800ms after mount, which is longer than the harness's
                default settle, so a run without it photographs the page the
                modal has not covered yet. */}
            <div
              data-testid="welcome-modal"
              className="bg-base-100 rounded-3xl shadow-2xl border border-base-200 p-6 sm:p-8 flex flex-col gap-4 max-h-[90dvh] overflow-y-auto"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto mb-4 shadow-md flex items-center justify-center">
                  <ReisLogo className="w-full h-full" />
                </div>
                <h2 className="text-xl font-bold text-base-content mb-2 tracking-tight">
                  {t('onboarding.welcome')}
                </h2>
                <p className="text-sm text-base-content/70 mb-5 leading-relaxed whitespace-pre-line">
                  {t('onboarding.description')}
                </p>

                <div className="flex justify-center mb-6">
                  <div className="join bg-base-300/50 p-0.5 rounded-lg border border-base-300">
                    <button
                      onClick={() => setLanguage('cz')}
                      className={`join-item btn btn-xs border-none h-6 min-h-0 w-12 ${language === 'cz' ? 'btn-primary shadow-sm' : 'btn-ghost opacity-50 hover:opacity-100'}`}
                    >
                      CZ
                    </button>
                    <button
                      onClick={() => setLanguage('en')}
                      className={`join-item btn btn-xs border-none h-6 min-h-0 w-12 ${language === 'en' ? 'btn-primary shadow-sm' : 'btn-ghost opacity-50 hover:opacity-100'}`}
                    >
                      EN
                    </button>
                  </div>
                </div>
              </div>

              {/* The hero. No fill of its own, on purpose, measured both
                  ways: `base-200` on the modal's `base-100` is 1.046:1 in the
                  light theme — under the 1.05 a surface needs to be seen at
                  all — and `base-300` reads, but drags the tonal button's
                  label down to 4.19:1 in the dark theme, under AA. So the
                  hairline carries the edge in either theme and the button
                  keeps the `base-100` it was toned for. The glyph disc is
                  tinted for the same reason `WelcomeWifiCard` tints its own. */}
              <div className="flex flex-col items-center gap-3 rounded-box border border-base-content/10 p-5 text-center">
                <span
                  aria-hidden
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
                >
                  <Wifi className="h-7 w-7" />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="text-base font-semibold tracking-tight">
                    {t('onboarding.wifiTitle')}
                  </p>
                  <p className="text-sm text-base-content/70 leading-relaxed">
                    {t('onboarding.wifiBody')}
                  </p>
                </div>
                <button
                  onClick={startEduroam}
                  className="btn btn-primary btn-md btn-block rounded-xl shadow-md gap-2"
                >
                  <Wifi className="w-4 h-4" />
                  {t('eduroam.native.button')}
                </button>
              </div>

              <button onClick={dismiss} className="btn btn-ghost btn-sm self-center">
                {t('onboarding.notNow')}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
