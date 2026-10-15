import { jarGeneration, loadJar, saveJar } from './iskamCookieStore';
import { iskamHop, type IskamHttpDeps } from './iskamHttp';
import { isAuthRedirect } from './iskamSession';
import { initTopUpUrl, parseGatewayUrl, type PayMethod } from './topUp';

export type InitResult = { kind: 'ok'; url: string } | { kind: 'expired' } | { kind: 'rejected' };

/**
 * Asks WebISKAM to create the GoPay payment. The amount is fixed here; GoPay
 * notifies WebISKAM server-side when it is paid, and an unpaid one times out
 * on GoPay's side, so starting one and walking away costs nothing.
 */
export async function initTopUp(
  http: IskamHttpDeps,
  amount: number,
  method: PayMethod
): Promise<InitResult> {
  const gen = jarGeneration();
  const jar = await loadJar();
  const { res, jar: next } = await iskamHop(http, jar, initTopUpUrl(amount, method), {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  await saveJar(next, gen);
  if (isAuthRedirect(res) || (res.status === 200 && !res.body.trim())) return { kind: 'expired' };
  if (res.status !== 200) throw new Error(`InitGopayPayment HTTP ${res.status}`);
  const url = parseGatewayUrl(res.body);
  return url ? { kind: 'ok', url } : { kind: 'rejected' };
}

/**
 * Opens GoPay in SFSafariViewController / a Chrome Custom Tab and resolves
 * when the student closes it. Not the InAppBrowser WebView: Google Pay inside a
 * WebView is untested, and the system view is where card autofill and Google
 * Pay live. The URL carries no session — GoPay's gateway needs none.
 */
export async function openGateway(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser');
  await new Promise<void>((resolve, reject) => {
    void (async () => {
      let handle: { remove(): Promise<void> } | undefined;
      try {
        handle = await Browser.addListener('browserFinished', () => {
          void handle?.remove();
          resolve();
        });
        await Browser.open({ url });
      } catch (e) {
        void handle?.remove();
        reject(e);
      }
    })();
  });
}
