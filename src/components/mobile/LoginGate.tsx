import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { logError } from '../../utils/reportError';

/**
 * Shown when the student dismisses the IS login WebView.
 *
 * Before this existed, backing out of login rejected out of boot() and left a
 * raw "reIS failed to start: Error: Login cancelled…" string on screen — which
 * is exactly the path an App Store reviewer takes, having no account to sign in
 * with. Hence the demo button living here rather than on a welcome screen: it
 * costs a normal student nothing, because a normal student never sees it.
 *
 * The disclaimer sits directly under the buttons, not in fine print: it's one
 * of only three remaining mitigations for App Store Guideline 5.2.2 (no
 * MENDELU permission was sought for reIS), and this screen is the first thing
 * both a reviewer and a first-run student see.
 *
 * Centred with a max width rather than stretched: the app ships the phone tree
 * on iPad too, so this renders at 1024pt as well as at 390.
 */
export function LoginGate({
  onSignIn,
  onDemoStarted,
}: {
  onSignIn: () => void;
  onDemoStarted: () => void;
}) {
  const { t } = useTranslation();
  const enterDemo = useAppStore((s) => s.enterDemo);
  // enterDemo() sequentially wipes 12 IndexedDB stores and 2 meta keys before
  // seeding the mock dataset. A slow device is exactly this screen's expected
  // audience (first run, no account yet), so a bare fire-and-forget click
  // handler invites a second tap that interleaves one call's wipe with the
  // other's seed and leaves the store half-populated.
  const [demoPending, setDemoPending] = useState(false);

  const handleDemoTap = async () => {
    if (demoPending) return;
    setDemoPending(true);
    try {
      await enterDemo();
      onDemoStarted();
    } catch (err) {
      // Leaving the button disabled here would strand the student on a dead
      // control with no account and no way forward, so clear pending on
      // failure and let them retry.
      logError('LoginGate.enterDemo', err);
    } finally {
      setDemoPending(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base-100 p-6">
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <h1 className="font-display text-2xl font-bold">{t('demo.gateTitle')}</h1>
        <p className="text-sm text-base-content/70">{t('demo.gateBody')}</p>

        <button className="btn btn-primary" onClick={onSignIn}>
          {t('demo.signIn')}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => void handleDemoTap()}
          disabled={demoPending}
        >
          {demoPending ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            t('demo.tryDemo')
          )}
        </button>

        {/* Legible compliance copy, not a footnote: this is one of only three
            remaining mitigations for App Store Guideline 5.2.2 (no MENDELU
            permission was sought), so it must read at body weight, not fine
            print. Matches text-sm/base-content of the body copy above and
            adds font-medium so a reviewer's eye lands on it. */}
        <p className="pt-2 text-sm font-medium text-base-content">{t('demo.disclaimer')}</p>
      </div>
    </div>
  );
}
