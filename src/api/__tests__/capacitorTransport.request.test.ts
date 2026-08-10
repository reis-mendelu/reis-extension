import { describe, it, expect } from 'vitest';
import { fetchViaCapacitor } from '../capacitorTransport';
import { deps, sentTo, TOKEN } from './capacitorDeps';

/** What fetchViaCapacitor puts ON the wire. Response handling is a sibling file. */
describe('fetchViaCapacitor request shaping', () => {
  describe('cookie delivery', () => {
    // MEASURED on device: android ignores a hand-set Cookie header (403) and
    // needs the native jar; ios is the exact inverse. Do not collapse this.
    it('seeds the native jar on android before requesting', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
      expect(d.setCookie).toHaveBeenCalledWith({
        url: 'https://is.mendelu.cz',
        key: 'UISAuth',
        value: TOKEN,
      });
    });

    it('does NOT seed the jar on ios', async () => {
      const d = deps({ platform: 'ios' });
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
      expect(d.setCookie).not.toHaveBeenCalled();
    });

    it('seeds the native jar for a POST on android too', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
        method: 'POST',
        body: 'a=1',
      });
      expect(d.setCookie).toHaveBeenCalled();
    });

    it('applies the iOS Cookie header LAST so a caller cannot detach the session', async () => {
      const d = deps({ platform: 'ios' });
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
        method: 'POST',
        body: 'a=1',
        headers: { Cookie: 'UISAuth=attacker-supplied' },
      });
      expect(sentTo(d.httpPost).headers.Cookie).toBe(`UISAuth=${TOKEN}`);
    });
  });

  describe('origin refusal', () => {
    it('refuses to send the session to a non-IS origin, and never requests it', async () => {
      const d = deps();
      await expect(fetchViaCapacitor('https://evil.example/steal', TOKEN, d)).rejects.toThrow(
        /evil\.example/
      );
      expect(d.httpGet).not.toHaveBeenCalled();
      expect(d.setCookie).not.toHaveBeenCalled();
    });

    it('refuses a lookalike host that merely ends with the IS domain', async () => {
      await expect(
        fetchViaCapacitor('https://is.mendelu.cz.evil.example/x', TOKEN, deps())
      ).rejects.toThrow(/refusing/i);
    });

    it('refuses a POST to a non-IS origin before sending anything', async () => {
      const d = deps();
      await expect(
        fetchViaCapacitor('https://evil.example.com/x', TOKEN, d, { method: 'POST', body: 'a=1' })
      ).rejects.toThrow(/refusing to send the IS session/);
      expect(d.httpPost).not.toHaveBeenCalled();
    });

    it('accepts a relative URL, which can only resolve to IS', async () => {
      const d = deps();
      await expect(fetchViaCapacitor('/auth/student/', TOKEN, d)).resolves.toBeInstanceOf(Response);
    });
  });

  describe('method dispatch', () => {
    it('sends a POST through httpPost with the body as data', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/wifi/certifikat.pl', TOKEN, d, {
        method: 'POST',
        body: 'lang=cz&gen=x',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      expect(d.httpPost).toHaveBeenCalledWith({
        url: 'https://is.mendelu.cz/auth/wifi/certifikat.pl',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: 'lang=cz&gen=x',
      });
      expect(d.httpGet).not.toHaveBeenCalled();
    });

    it('still routes a GET through httpGet, never httpPost', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
      expect(d.httpGet).toHaveBeenCalled();
      expect(d.httpPost).not.toHaveBeenCalled();
    });

    it('treats a lowercase method as POST', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
        method: 'post',
        body: 'a=1',
      });
      expect(d.httpPost).toHaveBeenCalled();
    });

    // A PUT/PATCH/DELETE used to fall through to httpGet with the body dropped and
    // the caller saw a 200 — the exact silent-wrong-request shape this transport
    // exists to eliminate.
    it.each(['PUT', 'PATCH', 'DELETE'])(
      'refuses to send a %s rather than downgrading it',
      async (m) => {
        const d = deps();
        await expect(
          fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, { method: m, body: 'a=1' })
        ).rejects.toThrow(/unsupported/i);
        expect(d.httpGet).not.toHaveBeenCalled();
        expect(d.httpPost).not.toHaveBeenCalled();
      }
    );
  });

  describe('body and headers', () => {
    // Regression: schedule.ts builds its POST body with `new URLSearchParams(...)`
    // and passes it straight through. The native bridge JSON.stringify's a
    // non-string `data`, and URLSearchParams has no enumerable own properties,
    // so it silently became "{}" — an empty body on the calendar's sync path.
    it('normalises a URLSearchParams body to its urlencoded string before it reaches httpPost', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl', TOKEN, d, {
        method: 'POST',
        body: new URLSearchParams({ rozvrh_student: '123', lang: 'cz' }),
      });
      expect(sentTo(d.httpPost).data).toBe('rozvrh_student=123&lang=cz');
    });

    it('throws instead of sending an unsupported body type', async () => {
      const d = deps();
      await expect(
        fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
          method: 'POST',
          body: new FormData(),
        })
      ).rejects.toThrow();
      expect(d.httpPost).not.toHaveBeenCalled();
    });

    it('defaults Content-Type to form-urlencoded on a POST when the caller supplied none', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
        method: 'POST',
        body: 'a=1',
      });
      expect(sentTo(d.httpPost).headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    });

    it('lets a caller-supplied Content-Type win over the default', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
        method: 'POST',
        body: '{"a":1}',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(sentTo(d.httpPost).headers['Content-Type']).toBe('application/json');
    });

    // Sync's ~236 GETs are device-verified with exactly this wire shape. client.ts
    // deliberately forwards only the CALLER's headers here, never DEFAULT_HEADERS.
    it('does not add a Content-Type header to a GET, ever', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d);
      expect(sentTo(d.httpGet).headers).toEqual({});
    });

    it('sends exactly the caller headers on a GET — no additions of any kind', async () => {
      const d = deps();
      await fetchViaCapacitor('https://is.mendelu.cz/auth/', TOKEN, d, {
        headers: { 'X-Custom': 'value' },
      });
      expect(sentTo(d.httpGet).headers).toEqual({ 'X-Custom': 'value' });
    });
  });
});
