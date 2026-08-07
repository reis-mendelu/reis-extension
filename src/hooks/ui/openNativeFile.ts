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
    const { delivered } = await openIsFileNatively(fullUrl);
    // Android saves into Downloads and posts a notification — but
    // POST_NOTIFICATIONS is a runtime grant, and a student who declined it (or
    // was never asked, which was the case) got NO signal at all while the file
    // saved perfectly. Confirmation must not ride on a droppable permission.
    // iOS is deliberately silent: its share sheet is already the confirmation.
    if (delivered === 'downloads') toast.success(t('course.file.savedToDownloads'));
  } catch (e) {
    logError(context, e);
    // A lapsed session returns silently here on purpose: `fetchIsBinary`
    // already raised the recovery prompt when it minted the error, and it did
    // so WITH the token the request used. Prompting again from here would pass
    // no token, which is exactly the case promptSessionRecovery cannot filter —
    // so a straggler from a superseded session would slip through and offer to
    // "repair" a session that is already healthy.
    //
    // The early return still matters: the generic toast must not fire on top
    // of the recovery prompt.
    if ((e as { sessionExpired?: boolean } | null)?.sessionExpired) return;
    toast.error(t('course.file.openFailed'));
  }
}
