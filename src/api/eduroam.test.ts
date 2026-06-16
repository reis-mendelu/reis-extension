import { describe, it, expect } from 'vitest';
import { parseCertPage } from './eduroam';

describe('parseCertPage', () => {
  it('detects an existing cert and extracts the CZ password', () => {
    const html = `
      <p>použijte prosím heslo <b>wIp.num.7.uzo</b></p>
      <ul><li><a href="certifikat.pl?get=user-p12;lang=cz">PKCS#12</a></li>
      <li><a href="certifikat.pl?get=root-der;lang=cz">root</a></li></ul>`;
    expect(parseCertPage(html)).toEqual({ hasCert: true, password: 'wIp.num.7.uzo' });
  });

  it('extracts the EN password variant', () => {
    const html = `please use the password <b>abc.def.1.ghi</b>
      <a href="certifikat.pl?get=user-p12;lang=en">p12</a>`;
    expect(parseCertPage(html).password).toBe('abc.def.1.ghi');
  });

  it('reports no cert when only the generate button is present', () => {
    const html = `<form><input type="submit" name="gen" value="Vygenerovat certifikát"></form>`;
    expect(parseCertPage(html)).toEqual({ hasCert: false, password: null });
  });
});
