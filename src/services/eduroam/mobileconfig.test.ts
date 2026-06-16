import { describe, it, expect } from 'vitest';
import { generateEduroamMobileconfig } from './mobileconfig';

const root = new Uint8Array([1, 2, 3]);
const p12 = new Uint8Array([4, 5, 6]);
const fixedUuids = { top: 'TOP', ca: 'CA', p12: 'P12', wifi: 'WIFI' };

describe('generateEduroamMobileconfig', () => {
  it('throws on empty rootCaDer', () => {
    expect(() =>
      generateEduroamMobileconfig({ rootCaDer: new Uint8Array(), clientP12: p12 }),
    ).toThrow(/rootCaDer/);
  });

  it('throws on empty clientP12', () => {
    expect(() =>
      generateEduroamMobileconfig({ rootCaDer: root, clientP12: new Uint8Array() }),
    ).toThrow(/clientP12/);
  });

  it('throws on empty serverNames', () => {
    expect(() =>
      generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, serverNames: [] }),
    ).toThrow(/serverNames/);
  });

  it('defaults the trusted server name to aleph.mendelu.cz', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    expect(xml).toContain('<string>aleph.mendelu.cz</string>');
  });

  it('points the Wi-Fi anchor at the CA payload UUID', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    const i = xml.indexOf('PayloadCertificateAnchorUUID');
    expect(i).toBeGreaterThan(-1);
    expect(xml.slice(i, i + 200)).toContain('<string>CA</string>');
  });

  it('anchors the server CA to the same UUID declared by the CA payload', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    // CA payload's own PayloadUUID (it follows the com.apple.security.root type).
    const caTypeIdx = xml.indexOf('<string>com.apple.security.root</string>');
    const caUuidIdx = xml.indexOf('<key>PayloadUUID</key>', caTypeIdx);
    const caUuid = xml.slice(caUuidIdx, caUuidIdx + 120).match(/<string>([^<]+)<\/string>/)?.[1];
    // The Wi-Fi anchor reference.
    const anchorIdx = xml.indexOf('PayloadCertificateAnchorUUID');
    const anchorUuid = xml.slice(anchorIdx, anchorIdx + 200).match(/<string>([^<]+)<\/string>/)?.[1];
    expect(caUuid).toBeTruthy();
    expect(anchorUuid).toBe(caUuid);
  });

  it('reflects caller-supplied serverNames in TLSTrustedServerNames', () => {
    const xml = generateEduroamMobileconfig({
      rootCaDer: root,
      clientP12: p12,
      serverNames: ['radius1.example.com', 'radius2.example.com'],
      uuids: fixedUuids,
    });
    const i = xml.indexOf('<key>TLSTrustedServerNames</key>');
    expect(i).toBeGreaterThan(-1);
    const block = xml.slice(i, i + 250);
    expect(block).toContain('<string>radius1.example.com</string>');
    expect(block).toContain('<string>radius2.example.com</string>');
    expect(xml).not.toContain('aleph.mendelu.cz');
  });

  it('selects the client identity via PayloadCertificateUUID', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    const i = xml.indexOf('<key>PayloadCertificateUUID</key>');
    expect(i).toBeGreaterThan(-1);
    expect(xml.slice(i, i + 80)).toContain('<string>P12</string>');
  });

  it('omits the pkcs12 password (OS prompts at install)', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    expect(xml).not.toContain('Password');
  });

  it('hard-enforces server validation (TLSAllowTrustExceptions false)', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    const i = xml.indexOf('TLSAllowTrustExceptions');
    expect(i).toBeGreaterThan(-1);
    expect(xml.slice(i, i + 45)).toContain('<false/>');
  });

  it('uses EAP-TLS (type 13)', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12, uuids: fixedUuids });
    expect(xml).toContain('<key>AcceptEAPTypes</key>');
    expect(xml).toContain('<integer>13</integer>');
  });

  it('base64-embeds the cert bytes', () => {
    const xml = generateEduroamMobileconfig({
      rootCaDer: new Uint8Array([0x4d, 0x61, 0x6e]), // "Man"
      clientP12: p12,
      uuids: fixedUuids,
    });
    expect(xml).toContain('<data>TWFu</data>');
  });

  it('generates random UUIDs when none injected', () => {
    const xml = generateEduroamMobileconfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).not.toContain('<string>TOP</string>');
    expect(xml).toContain('<key>PayloadUUID</key>');
  });
});
