import { describe, it, expect } from 'vitest';
import { initTopUpUrl, parseGatewayUrl, validateAmount } from '../topUp';

describe('validateAmount', () => {
  it.each([
    ['1', 1],
    ['15000', 15000],
    [' 50 ', 50],
    ['1 500', 1500],
    ['1\u00a0500', 1500],
  ])('accepts %j', (text, amount) => {
    expect(validateAmount(text)).toEqual({ ok: true, amount });
  });

  it.each(['', '0', '-5', '12,5', '12.5', '15001', 'abc', '1e3'])('rejects %j', (text) => {
    expect(validateAmount(text)).toEqual({ ok: false });
  });
});

describe('initTopUpUrl', () => {
  it('builds the GET the WebISKAM page itself sends, for the Hlavní konto', () => {
    const u = new URL(initTopUpUrl(250, 'gpay'));
    expect(u.origin + u.pathname).toBe('https://webiskam.mendelu.cz/Platby/InitGopayPayment');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      CastkaZadana: '250',
      VybranaMetoda: 'GPAY',
      TypKonta: '0',
      PoSplatnosti: 'False',
      PoSplatnostiPozadavkyNaUhrady: 'False',
      PredSplatnosti: 'False',
      PredSplatnostiPozadavkyNaUhrady: 'False',
      IDEShopObjednavky: '',
    });
    expect(new URL(initTopUpUrl(1, 'card')).searchParams.get('VybranaMetoda')).toBe('PAYMENT_CARD');
  });
});

describe('parseGatewayUrl', () => {
  const form = (action: string) =>
    `<form action="${action}" method="post" id="gopay-payment-button"><input type="hidden" name="signature" /><button id="makepayment">Zaplatit</button></form>`;

  it('extracts the GoPay gateway action', () => {
    expect(parseGatewayUrl(form('https://gate.gopay.com/gw-ui/rest/v3/123456'))).toBe(
      'https://gate.gopay.com/gw-ui/rest/v3/123456'
    );
  });

  // WebISKAM's real answer on 2026-11-12: the gateway moved to checkout.gopay.com and
  // the host allowlist rejected it, so every top-up failed before GoPay opened.
  it('accepts the checkout.gopay.com gateway WebISKAM sends now', () => {
    expect(
      parseGatewayUrl(
        form('https://checkout.gopay.com/gw-ui/rest/v3/e670ab5207c5c4a815db8bec2f3e3929')
      )
    ).toBe('https://checkout.gopay.com/gw-ui/rest/v3/e670ab5207c5c4a815db8bec2f3e3929');
  });

  it.each([
    'https://checkout.gopay.com.evil.example/gw-ui/rest/v3/1',
    'https://checkout.gopay.com:8443/gw-ui/rest/v3/1',
    'http://checkout.gopay.com/gw-ui/rest/v3/1',
    'https://checkout.gopay.com/other/1',
    'https://gate.gopay.com.evil.example/gw-ui/rest/v3/1',
    'https://gate.gopay.com:8443/gw-ui/rest/v3/1',
    'http://gate.gopay.com/gw-ui/rest/v3/1',
    'https://gate.gopay.com/other/1',
    'https://evil.example/gw-ui/1',
    'javascript:alert(1)',
    '/gw-ui/rest/v3/1',
  ])('rejects %s', (action) => {
    expect(parseGatewayUrl(form(action))).toBeNull();
  });

  it('returns null for an empty body (what an expired session gets)', () => {
    expect(parseGatewayUrl('')).toBeNull();
    expect(parseGatewayUrl('   ')).toBeNull();
  });
});
