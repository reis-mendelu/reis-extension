import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

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
export function LoginGate({ onSignIn }: { onSignIn: () => void }) {
  const { t } = useTranslation();
  const enterDemo = useAppStore((s) => s.enterDemo);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-base-100 p-6">
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <h1 className="font-display text-2xl font-bold">{t('demo.gateTitle')}</h1>
        <p className="text-sm text-base-content/70">{t('demo.gateBody')}</p>

        <button className="btn btn-primary" onClick={onSignIn}>
          {t('demo.signIn')}
        </button>
        <button className="btn btn-ghost" onClick={() => void enterDemo()}>
          {t('demo.tryDemo')}
        </button>

        <p className="pt-2 text-xs text-base-content/50">{t('demo.disclaimer')}</p>
      </div>
    </div>
  );
}
