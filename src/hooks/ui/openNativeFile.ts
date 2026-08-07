import { toast } from 'sonner';
import { logError } from '../../utils/reportError';
import { openIsFileNatively } from '../../mobile/openIsFile';

/**
 * The native branch of useFileActions' openFile/downloadSingle, with the error
 * handling the web path gets for free.
 *
 * The web path degrades: a failed fetch falls back to window.open, so the
 * student still gets something. Capacitor has no such fallback — window.open
 * there hands the URL to the SYSTEM BROWSER, which has no IS session — so a
 * failure has to be caught and *said*. Every caller drops this promise (the
 * prop type is `(link: string) => void`, FileListItem.tsx:31), so without this
 * an IS-served-a-page or lapsed-session error escapes as an unhandled
 * rejection: a telemetry report fires and the student sees a tap that did
 * nothing at all.
 *
 * `t` is passed in rather than read from useTranslation here so this stays a
 * plain function — the caller is already a hook and owns the subscription.
 */
export async function openNativeFile(
  fullUrl: string,
  context: string,
  t: (key: string) => string
): Promise<void> {
  try {
    await openIsFileNatively(fullUrl);
  } catch (e) {
    logError(context, e);
    // A lapsed session is the one failure the student can act on, so it is
    // named rather than folded into the generic message. Re-login is not wired
    // up on mobile yet — the extension redirects to login.pl from
    // messageHandler, which has no Capacitor equivalent.
    const expired = (e as { sessionExpired?: boolean } | null)?.sessionExpired;
    toast.error(expired ? t('course.file.sessionExpired') : t('course.file.openFailed'));
  }
}
