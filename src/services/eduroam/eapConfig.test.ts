import { describe, it, expect } from 'vitest';
import { generateEapConfig } from './eapConfig';

const root = new Uint8Array([0x4d, 0x61, 0x6e]); // "Man" -> "TWFu"
const p12 = new Uint8Array([1, 2, 3]);

describe('generateEapConfig', () => {
  it('throws on empty rootCaDer', () => {
    expect(() => generateEapConfig({ rootCaDer: new Uint8Array(), clientP12: p12 })).toThrow(/rootCaDer/);
  });

  it('throws on empty clientP12', () => {
    expect(() => generateEapConfig({ rootCaDer: root, clientP12: new Uint8Array() })).toThrow(/clientP12/);
  });

  it('throws on empty serverNames', () => {
    expect(() => generateEapConfig({ rootCaDer: root, clientP12: p12, serverNames: [] })).toThrow(/serverNames/);
  });

  it('emits an EAPIdentityProviderList root with EAP-TLS type 13', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml).toContain('<EAPIdentityProviderList');
    expect(xml).toContain('<EAPMethod>');
    expect(xml).toContain('<Type>13</Type>');
  });

  it('embeds the root CA as X.509 base64 and the client cert as PKCS12 base64', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).toContain('<CA format="X.509" encoding="base64">TWFu</CA>');
    expect(xml).toContain('<ClientCertificate format="PKCS12" encoding="base64">AQID</ClientCertificate>');
  });

  it('defaults the server id to aleph.mendelu.cz', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).toContain('<ServerID>aleph.mendelu.cz</ServerID>');
  });

  it('targets the eduroam SSID', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).toContain('<SSID>eduroam</SSID>');
  });

  it('NEVER embeds a passphrase (geteduroam prompts)', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).not.toContain('<Passphrase>');
  });

  it('XML-escapes special characters in server names', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12, serverNames: ['a&b<c'] });
    expect(xml).toContain('<ServerID>a&amp;b&lt;c</ServerID>');
  });

  // geteduroam's Android parser (Simple XML model) marks `version` and
  // `ProviderInfo` as REQUIRED — stricter than the official eap-metadata.xsd,
  // which lists both as optional. Omitting them parses fine against the schema
  // but makes geteduroam reject the file as "Not a valid .eap-config file".
  it('sets the required version attribute on EAPIdentityProvider', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).toMatch(/<EAPIdentityProvider\b[^>]*\bversion="1"/);
  });

  it('includes a ProviderInfo with a DisplayName (required by geteduroam)', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml).toContain('<ProviderInfo>');
    expect(xml).toMatch(/<DisplayName>[^<]+<\/DisplayName>/);
  });

  it('orders ProviderInfo after CredentialApplicability (XSD sequence)', () => {
    const xml = generateEapConfig({ rootCaDer: root, clientP12: p12 });
    expect(xml.indexOf('</CredentialApplicability>')).toBeLessThan(xml.indexOf('<ProviderInfo>'));
  });
});
