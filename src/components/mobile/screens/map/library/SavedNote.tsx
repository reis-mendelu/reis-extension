import { useTranslation } from '../../../../../hooks/useTranslation';

const clock = (at: number, lang: 'cz' | 'en') =>
  new Date(at).toLocaleTimeString(lang === 'cz' ? 'cs' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

/**
 * When the grid below was taken from the library: "refreshing" while the last
 * saved answer is on screen, a plain time once the library has answered. The line
 * is always there once there is a time, so its coming and going never moves the
 * grid under a thumb that is about to tap.
 */
export function SavedNote({
  at,
  saved,
  loading,
}: {
  at: number | null;
  saved: boolean;
  loading: boolean;
}) {
  const { t, language } = useTranslation();
  const time = at === null ? '' : clock(at, language);
  const key = !saved
    ? 'mobile.library.freshAt'
    : loading
      ? 'mobile.library.savedLoading'
      : 'mobile.library.savedFailed';
  return (
    <p role="status" className="flex min-h-4 items-center gap-2 text-xs text-base-content/70">
      {at !== null && (
        <>
          {saved && loading && (
            <span className="loading loading-spinner loading-xs" aria-hidden="true" />
          )}
          {t(key, { time })}
        </>
      )}
    </p>
  );
}
