import { ISKAM_ORIGIN } from './iskamJar';

export const TOP_UP_MIN = 1;
export const TOP_UP_MAX = 15_000;

export type AmountCheck = { ok: true; amount: number } | { ok: false };
export type PayMethod = 'card' | 'gpay';

/** Whole crowns, 1 – 15 000; spaces and NBSP allowed as thousands separators. */
export function validateAmount(text: string): AmountCheck {
  const t = text.replace(/\s/g, '');
  if (!/^\d+$/.test(t)) return { ok: false };
  const amount = Number(t);
  return amount >= TOP_UP_MIN && amount <= TOP_UP_MAX ? { ok: true, amount } : { ok: false };
}

const METHOD: Record<PayMethod, string> = { card: 'PAYMENT_CARD', gpay: 'GPAY' };

/**
 * The GET WebISKAM's own top-up page sends (its `$.ajax` says `Type:` instead
 * of `type:`, so jQuery sends GET). `TypKonta=0` is the Hlavní konto.
 */
export function initTopUpUrl(amount: number, method: PayMethod): string {
  const q = new URLSearchParams({
    CastkaZadana: String(amount),
    VybranaMetoda: METHOD[method],
    TypKonta: '0',
    PoSplatnosti: 'False',
    PoSplatnostiPozadavkyNaUhrady: 'False',
    PredSplatnosti: 'False',
    PredSplatnostiPozadavkyNaUhrady: 'False',
    IDEShopObjednavky: '',
  });
  return `${ISKAM_ORIGIN}/Platby/InitGopayPayment?${q.toString()}`;
}

/**
 * The gateway URL from InitGopayPayment's ~300-byte form, or null.
 *
 * This URL is opened in a browser on the student's phone and they type card
 * details into whatever it shows, so only GoPay's own gateway is accepted —
 * exact host, https, the /gw-ui/ path. An empty body is what an expired
 * session gets; the caller tells that case apart before calling this.
 */
export function parseGatewayUrl(html: string): string | null {
  if (!html.trim()) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const action =
    doc.querySelector('form#gopay-payment-button')?.getAttribute('action') ??
    doc.querySelector('form[action]')?.getAttribute('action');
  if (!action) return null;
  let u: URL;
  try {
    u = new URL(action);
  } catch {
    return null;
  }
  if (
    u.protocol !== 'https:' ||
    u.hostname !== 'gate.gopay.com' ||
    !u.pathname.startsWith('/gw-ui/')
  ) {
    return null;
  }
  return u.toString();
}
