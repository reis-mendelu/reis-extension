import { describe, it, expect } from 'vitest';
import { readBytesBody } from './readBytesBody';
import { base64ToBytes } from '../services/eduroam/base64';

describe('readBytesBody', () => {
  // The p12 carries the student's private key: a byte that changes on the way
  // through postMessage is a profile that fails only at install time.
  it('round-trips every byte value exactly through base64', async () => {
    const all = new Uint8Array(256).map((_, i) => i);
    const res = new Response(all, { headers: { 'content-type': 'application/x-pkcs12' } });
    expect(Array.from(base64ToBytes(await readBytesBody(res)))).toEqual(Array.from(all));
  });

  it('THROWS on an HTML body whatever its casing — a page is not a certificate', async () => {
    const res = new Response('<html>login</html>', {
      headers: { 'content-type': 'Text/HTML; charset=UTF-8' },
    });
    await expect(readBytesBody(res)).rejects.toThrow(/HTML/);
  });
});
