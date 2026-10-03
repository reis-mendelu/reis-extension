import { describe, it, expect } from 'vitest';
import { certNotAfter } from './certValidity';
import { base64ToBytes } from './base64';

// Synthetic certificates from a throwaway test CA (openssl x509 -req with
// -not_before / -not_after). Same shape as IS's `get=user-der`: a bare DER
// X.509 certificate, CN=<login>@mendelu.cz. No real student's certificate.
const EXPIRED =
  'MIICNDCCARygAwIBAgIUMrn7ZQT+x/nKOtF/FDIXwjy5cxcwDQYJKoZIhvcNAQELBQAwFDESMBAGA1UEAwwJVGVzdCBSb290MB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEwMTEyMDAwMFowGzEZMBcGA1UEAwwQeHRlc3RAbWVuZGVsdS5jejBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABF3mIB0YgTZZe2wS5XHmFuznoWmLGOYASX5wNVD5z0S1ZcYqJ1m2cKoW1h1uzNbOvXX725560WcrZdAT+jsOKs6jQjBAMB0GA1UdDgQWBBQj1wHwTdId87wF+iaW3zxmXDCe9zAfBgNVHSMEGDAWgBTkIE0iF9krSvW0AQYnjXnM44U0xzANBgkqhkiG9w0BAQsFAAOCAQEAg6xwegiDTG/lbfJ1VC5rzx58SSeQTF5zDsZvCNnhlbk8lwtrVyBZvSnG989i15nroXR/ShQ36RO5aTmzPJIac/qezuYeQcmOeENMxTfjbfTMXb8H0GWD1rELhp0SAnkdb4D7oqQlC1MutpFch7jTZy+zkTyVujsyaugGiwDDsVwafoRofZBrFv22mAS8UmmoSRS1w3+9i1t28SVKUWYYMrxETevRoNSpxJ1zlUF92zlEGFgo9cj2A0h/xmpYrK4PCjl5pzP4i14It8cLr10DvBCNK10jl+1vir5mgKCDHBLam6h/KiEHOklgqp9Xf0PTuAhKOOSN1955GlxTmgZEGQ==';
const UTC_2027 =
  'MIICNDCCARygAwIBAgIUMrn7ZQT+x/nKOtF/FDIXwjy5cxgwDQYJKoZIhvcNAQELBQAwFDESMBAGA1UEAwwJVGVzdCBSb290MB4XDTI2MDkyMTA1NDM0OVoXDTI3MDkyMjA1NDM0OVowGzEZMBcGA1UEAwwQeHRlc3RAbWVuZGVsdS5jejBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABF3mIB0YgTZZe2wS5XHmFuznoWmLGOYASX5wNVD5z0S1ZcYqJ1m2cKoW1h1uzNbOvXX725560WcrZdAT+jsOKs6jQjBAMB0GA1UdDgQWBBQj1wHwTdId87wF+iaW3zxmXDCe9zAfBgNVHSMEGDAWgBTkIE0iF9krSvW0AQYnjXnM44U0xzANBgkqhkiG9w0BAQsFAAOCAQEANGSfq/uIla2AhasCmpqsDNuYw837wo2Q/7kGK6AW3KKZR6x91VNb7t8MWMm2p2nFAYDUt9yE859aGi7lUKBqGagnYFVT9nzgYtfnjp7lvIunUvjPJ1lpBge4z4EoTtnPRg4DHNfu352pumDA4TvHg7XCNzYjdH9OAq1u4DZ1OrqWZE/nf9+Qlj8gLgb9OyZkYG1GfQmmfiQNYYSEpXID4tn7dcDiSvXB32xLwpRpuJCyPvMl1hrgq74xoc/UJwmsbyllv/PcE/AFKTdTTpbb0OxjgWVj/Xy7n1CNWeNyWxexvHLI58WYLdMW6ZlYLemxRxaXNgVDeJgxkL6vbt4b+w==';
const GENERALIZED_2051 =
  'MIICNjCCAR6gAwIBAgIUMrn7ZQT+x/nKOtF/FDIXwjy5cxkwDQYJKoZIhvcNAQELBQAwFDESMBAGA1UEAwwJVGVzdCBSb290MCAXDTI2MDEwMTAwMDAwMFoYDzIwNTEwMzE1MDgzMDAwWjAbMRkwFwYDVQQDDBB4dGVzdEBtZW5kZWx1LmN6MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEXeYgHRiBNll7bBLlceYW7OehaYsY5gBJfnA1UPnPRLVlxionWbZwqhbWHW7M1s69dfvbnnrRZytl0BP6Ow4qzqNCMEAwHQYDVR0OBBYEFCPXAfBN0h3zvAX6JpbfPGZcMJ73MB8GA1UdIwQYMBaAFOQgTSIX2StK9bQBBieNeczjhTTHMA0GCSqGSIb3DQEBCwUAA4IBAQBxJ4uBfgqA8pxZAkHp2s7ehn1YEjKmEbDWbQZ2gBzQc+XI45UeXaJp0KJietxKpvUhsdqO75e04Rln2YUOfP6By3MgxJQlyviQ7JhO+jFFbb4vcnd94EoJ0yimmipYK8zRE9WPjLtUll/8xrSWoe6pAODF65kNKVz8duT8tFIvq+0CjtLwrJG6KdKWfHHbe+pfUIcLfL5MB2mWsub6QhWJEzgrXhUAgzg70h9hbTcAOYlLfwWcO3BQjwMQhqsJSj+5S7QbEyt8BIQwL0I4ZqGrev9zR16iXpa6yl0gmRWnd4pK9KuP2d8Tzv8WtRPdyLG/tdrPbwvm+UMRtLc3mT4Q';

describe('certNotAfter', () => {
  it('reads an expired certificate', () => {
    expect(certNotAfter(base64ToBytes(EXPIRED))).toEqual(new Date('2025-01-01T12:00:00Z'));
  });

  // IS issues for 366 days, so every real expiry is a UTCTime (two-digit year).
  it('reads a UTCTime notAfter, the shape IS issues', () => {
    expect(certNotAfter(base64ToBytes(UTC_2027))).toEqual(new Date('2027-09-22T05:43:49Z'));
  });

  // RFC 5280 §4.1.2.5: dates from 2050 on are GeneralizedTime.
  it('reads a GeneralizedTime notAfter', () => {
    expect(certNotAfter(base64ToBytes(GENERALIZED_2051))).toEqual(new Date('2051-03-15T08:30:00Z'));
  });

  // The check only adds information, so anything it cannot read is "unknown",
  // never an error and never "expired".
  it.each([
    ['empty', new Uint8Array()],
    ['not DER', new TextEncoder().encode('<html>Přihlášení</html>')],
    ['truncated', base64ToBytes(UTC_2027).slice(0, 80)],
  ])('returns null for %s input', (_, bytes) => {
    expect(certNotAfter(bytes)).toBeNull();
  });
});
