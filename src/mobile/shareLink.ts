import { getPlatform } from '../platform';
import { isShareCancellation } from '../errors/shareCanceled';
import { logError } from '../utils/reportError';

/**
 * Hand a link on to someone else: the system share sheet on the phone and
 * iPad, the clipboard everywhere else.
 *
 * Not `navigator.share` on the extension: Firefox has none, and Chrome's on a
 * desktop opens a picker most students have never seen. A copied link pastes
 * into whatever chat they already have open. The caller says "copied" only on
 * `'copied'`, so a blocked clipboard never claims it worked.
 */
export type ShareLinkResult = 'shared' | 'copied' | 'canceled' | 'failed';

export async function shareLink(url: string): Promise<ShareLinkResult> {
  if (getPlatform().kind === 'capacitor') {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({ url });
      return 'shared';
    } catch (e) {
      if (isShareCancellation(e)) return 'canceled';
      logError('Mobile.shareLink', e);
      return 'failed';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch (e) {
    logError('Mobile.shareLink', e);
    return 'failed';
  }
}
