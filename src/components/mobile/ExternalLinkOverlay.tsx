import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Says the app is working while an IS link is on its way to the in-app browser.
 *
 * The browser itself cannot come any sooner. capgo withholds it until the page
 * has loaded end to end, and the flag that would present it earlier
 * (`isPresentAfterPageLoad: false`) is rejected outright by BOTH platforms when
 * a `preShowScript` is sent with it — and the script is how the session cookie
 * gets in, so it cannot be dropped either. See `mobile/openExternal`, which
 * carries the citations, and the test that pins the flag.
 *
 * So for the seconds a desktop IS page takes, this is the only thing that can
 * answer the tap: "while waiting for a file to open or a vyveska item to open
 * in IS there's no loading so it seems the button is not working".
 *
 * It is deliberately a BLOCKING scrim. The complaint ends in a second tap, and
 * a second tap opens a second browser.
 */

/**
 * How long a tap may go unanswered before it needs explaining.
 *
 * A cached page, or anything that is not IS (those go to Safari/Custom Tabs and
 * present at once), is usually done well inside this — and a spinner that
 * appears and vanishes in 100ms reads as a glitch, not as feedback. Only a wait
 * long enough to doubt gets a spinner.
 */
const SHOW_AFTER_MS = 250;

export function ExternalLinkOverlay() {
  const opening = useAppStore((s) => s.externalOpening);
  // Split so the delay resets by UNMOUNTING rather than by writing state from
  // an effect: the scrim below owns a timer and nothing else, and a link that
  // finished inside the delay takes the whole timer with it. The obvious
  // single-component version has to `setVisible(false)` synchronously in an
  // effect, which is a cascading render and what react-hooks/set-state-in-effect
  // is there to stop.
  if (!opening) return null;
  return <DelayedScrim />;
}

function DelayedScrim() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      data-testid="external-opening"
      role="status"
      aria-live="polite"
      // Above EVERYTHING, because an IS link is tapped from inside the things
      // that stack: a sheet's panel reaches z-[61] (Sheet.tsx) and the map's
      // Leaflet chrome sits at z-[1000]. z-index beats DOM order, so being the
      // last child is not enough — at z-50 this rendered UNDER the vývěska
      // sheet it was supposed to cover, which is where the link was tapped.
      className="absolute inset-0 z-[1100] flex flex-col items-center justify-center gap-3 bg-base-300/60 backdrop-blur-sm"
    >
      <span className="loading loading-spinner loading-lg text-primary" />
      <span className="text-sm font-medium text-base-content">{t('mobile.openingLink')}</span>
    </div>
  );
}
