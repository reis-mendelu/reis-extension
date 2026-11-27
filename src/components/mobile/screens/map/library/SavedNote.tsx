import { useTranslation } from '../../../../../hooks/useTranslation';

const clock = (at: number, lang: 'cz' | 'en') =>
  new Date(at).toLocaleTimeString(lang === 'cz' ? 'cs' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Prague',
  });

/**
 * Says the grid below is the library's last answer, kept on this device, and
 * when it was taken, while the new one is read (or after that read failed).
 */
export function SavedNote({ at, loading }: { at: number; loading: boolean }) {
  const { t, language } = useTranslation();
  const time = clock(at, language);
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-base-content/70">
      {loading && <span className="loading loading-spinner loading-xs" aria-hidden="true" />}
      {t(loading ? 'mobile.library.savedLoading' : 'mobile.library.savedFailed', { time })}
    </p>
  );
}
