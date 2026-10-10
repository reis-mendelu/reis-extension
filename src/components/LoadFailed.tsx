import { CloudOff } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

/**
 * "We could not find out" — the state an empty screen must not stand in for.
 *
 * Shared by both trees: the phone's whole-screen `ScreenError`, and the drawer
 * tabs (Files, Záznamník) that DrawerTabBody renders on desktop and phone alike.
 * The caller owns the retry, because the right one differs: a screen re-runs
 * the sync, a drawer tab refetches its own subject — a whole `user` crawl is
 * about a hundred IS requests to retry one folder.
 */
export function LoadFailed({ testId, onRetry }: { testId: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    // role="alert": it can replace a tab's content with no click before it,
    // and nothing else would tell a screen reader the load failed.
    <div
      role="alert"
      data-testid={testId}
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-6 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning/15 text-warning">
        <CloudOff size={28} />
      </div>
      <div className="font-display text-lg font-bold">{t('mobile.loadFailed.title')}</div>
      <div className="max-w-56 text-sm text-base-content/60">{t('mobile.loadFailed.body')}</div>
      {/* No button the caller cannot honour — a retry that silently does
          nothing is worse than none. */}
      {onRetry && (
        <button type="button" className="btn btn-primary btn-sm mt-1" onClick={onRetry}>
          {t('mobile.loadFailed.retry')}
        </button>
      )}
    </div>
  );
}
