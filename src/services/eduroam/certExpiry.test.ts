import { describe, it, expect } from 'vitest';
import { parseCertNotAfter, formatValidUntil, parseCertSubjectCN } from './certExpiry';

// Fixtures generated with openssl (see scripts / commit notes):
//  - v1: no [0] version field, notAfter 2027-07-04 09:42:47 UTC
//  - v3: has [0] version (clientAuth EKU) — the MENDELU cert shape —
//        notAfter 2027-07-05 09:43:38 UTC
const V1_DER_B64 =
  'MIICtjCCAZ4CCQCIbkVkRyMnvjANBgkqhkiG9w0BAQsFADAdMRswGQYDVQQDDBJmaXh0dXJlQG1lbmRlbHUuY3owHhcNMjYwNzA0MDk0MjQ3WhcNMjcwNzA0MDk0MjQ3WjAdMRswGQYDVQQDDBJmaXh0dXJlQG1lbmRlbHUuY3owggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC/zK1sgkU4lRYYs+hZA/C4rVUMWmZTefh1e8wL9/o6BeLNRU5w7lrid7jwTr5Ws3rVfFPvCyP5rCYMCDXEcIWING4frbB3xCsHmd+VDt3KEKcWKLosUJ2AlhMberAaDfdz0LIHjSKu91yjFP7QdG81CSzAC1DKL38FW3bi3LJ36ijGulqjZdmYHmYHEPf7AG5SfIcmMSixiaJKDfVTs+TfuByChR9vVXDdtgr9nfDhfAkOWQ1tULsvfTKzGAreQ2Hp0bryxvhPxObRvT0HTnb2wX4ljd9tkwey4/DPLQWmrGw3juI3VtwzIw4KPdFKFlRWnTfcJ6MpKlLDlQ372YAxAgMBAAEwDQYJKoZIhvcNAQELBQADggEBALJVqMM9kL8t/Q58fQBkTj0Ws1UP/ByGnYVH3iPOWYtMm3RhiijumkbjE7SNtq3mpBwfyTjEufIuJvxyKLHNbzZyiZk6kDQmHPCNTsqtr2UpMtyECzvGP+h1zDOzVwF2mIn96xpa7iQt/W/tg7BP4b1G97djweNw+c8JZ+3YsmKsvTKtb2+SFIyvwDSK3GQmO3cnyCqKV2rGQU6k96gZclbXzQRD1E4x7vMU0M9wlQFX4xQ8Nqm5yZuZ2zG/Tg85rV3r7NFheuLofZdOfZXNvZLLtVmrG43Llz0QiJDSc+o1fsj0m0Nx0paNNYTfNCxlF0V7gYDZZJrf0+fcbQWznBs=';
const V3_DER_B64 =
  'MIIC0jCCAbqgAwIBAgIJAMTHcqGh7lL1MA0GCSqGSIb3DQEBCwUAMBwxGjAYBgNVBAMMEXYzdXNlckBtZW5kZWx1LmN6MB4XDTI2MDcwNDA5NDMzOFoXDTI3MDcwNTA5NDMzOFowHDEaMBgGA1UEAwwRdjN1c2VyQG1lbmRlbHUuY3owggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQC9g1sFEdRCFSMZ1di44I9NmbmtQdCMbz3XrhRDWV27/3jo91w/eIhShAifoxZXSILTrUmY3ejN2rpjys1ZOyvtsYNJZ5qblESz+mtScOL27JV01lV77AIHrWYKMhqiGjJV/1Pl538a86dSgx8312IqsO2cvH4k99+VTOcmlZ7H6XLnbJQsxv0x/PJstkj/NHZOGDONjqJrugXqM9lMaz/FatEDuwRUCTn2VO1HnIk+kYJbBnqzQdWBlHD/ar/aF97YtNNjX71pxn2b3mJGndlVW67BrkdLIuyK7YRvEzMJH4ApbIE3B1fcay2YRh00hY3jQ3Ku7gMb/rRxSYSxsEnlAgMBAAGjFzAVMBMGA1UdJQQMMAoGCCsGAQUFBwMCMA0GCSqGSIb3DQEBCwUAA4IBAQCEuywq26ff/Cu5z4YZTHcIeKz9wlhmlCoDjWOG2NQnmAUCig+uKoOQoTToB1OABqzsjF+1hX/CTi/JHEPOaS4y/Oh75SsICm2ZrR3bq3WBXX19vBh4cuKRvJfvLGVViDOCpj8mGUWSSTc5gg889xG+9gOhQfOKFx/vHhdygDXglN97OY6mVbiIVShQe9AJJ/z184iiANLp6QOoRM7z1iKNbOe6CZl/cMXeHXwWC+CWMPT7WYRAtdrUq5H6R1rq3xnA/B4/iv55T+AWnrF27VQcdmQ6UB8n1vVEu+IuBIe4aZssQenhyOFrx3Jtm9AOaaFM3bBH/uDm/K2Z6XjoxD98';

const derFrom = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

describe('parseCertNotAfter', () => {
  it('reads notAfter from a v1 cert (no version field)', () => {
    const d = parseCertNotAfter(derFrom(V1_DER_B64));
    expect(d.toISOString()).toBe('2027-07-04T09:42:47.000Z');
  });

  it('reads notAfter from a v3 cert (skips the [0] version field)', () => {
    const d = parseCertNotAfter(derFrom(V3_DER_B64));
    expect(d.toISOString()).toBe('2027-07-05T09:43:38.000Z');
  });

  it('throws on non-certificate bytes', () => {
    expect(() => parseCertNotAfter(new Uint8Array([0x02, 0x01, 0x01]))).toThrow(/certExpiry/);
  });
});

describe('parseCertSubjectCN', () => {
  it('reads the CN (= EAP-TLS identity) from a v1 cert', () => {
    expect(parseCertSubjectCN(derFrom(V1_DER_B64))).toBe('fixture@mendelu.cz');
  });

  it('reads the CN from a v3 cert (skips the [0] version field)', () => {
    expect(parseCertSubjectCN(derFrom(V3_DER_B64))).toBe('v3user@mendelu.cz');
  });

  it('throws on non-certificate bytes', () => {
    expect(() => parseCertSubjectCN(new Uint8Array([0x02, 0x01, 0x01]))).toThrow(/certExpiry/);
  });
});

describe('formatValidUntil', () => {
  it('formats as geteduroam SERVER_DATE_FORMAT (UTC, no Z, no millis)', () => {
    expect(formatValidUntil(new Date('2027-07-04T09:42:47.000Z'))).toBe('2027-07-04T09:42:47');
  });

  it('zero-pads all fields', () => {
    expect(formatValidUntil(new Date('2027-01-02T03:04:05.000Z'))).toBe('2027-01-02T03:04:05');
  });
});
