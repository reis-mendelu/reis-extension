// When the student's eduroam certificate stops being valid, read from the
// certificate itself — IS's `certifikat.pl?get=user-der`, a bare DER X.509.
//
// Deliberately not from the cert page. The page shows only the ISSUE date
// ("existuje certifikát ze dne 21. 9. 2026"), and what it shows for an expired
// certificate has never been sampled, so a page parser would be a guess. The
// certificate's own notAfter is authoritative on any page shape.
//
// Pure, no network. Anything unreadable is `null` — unknown, never "expired".

interface Tlv {
  tag: number;
  start: number; // first content byte
  end: number; // one past the last content byte
}

function readTlv(der: Uint8Array, at: number): Tlv | null {
  if (at + 2 > der.length) return null;
  const tag = der[at]!;
  let len = der[at + 1]!;
  let start = at + 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4 || start + n > der.length) return null;
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + der[start + i]!;
    start += n;
  }
  const end = start + len;
  return end > der.length ? null : { tag, start, end };
}

const SEQUENCE = 0x30;
const UTC_TIME = 0x17;
const GENERALIZED_TIME = 0x18;
const VERSION_TAG = 0xa0; // [0] EXPLICIT, optional

function parseTime(der: Uint8Array, t: Tlv): Date | null {
  const s = String.fromCharCode(...der.subarray(t.start, t.end));
  // RFC 5280 §4.1.2.5: both forms are UTC with seconds and a trailing Z.
  const m =
    t.tag === UTC_TIME
      ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s)
      : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s);
  if (!m) return null;
  let year = Number(m[1]);
  // Two-digit years: 50–99 are 19xx, 00–49 are 20xx (same section).
  if (t.tag === UTC_TIME) year += year >= 50 ? 1900 : 2000;
  const ms = Date.UTC(
    year,
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6])
  );
  return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * The certificate's notAfter, or null if `der` is not a readable X.509.
 *
 * Certificate ::= SEQUENCE { tbsCertificate SEQUENCE { [0] version OPTIONAL,
 * serialNumber, signature, issuer, validity SEQUENCE { notBefore, notAfter },
 * … }, … }
 */
export function certNotAfter(der: Uint8Array): Date | null {
  const cert = readTlv(der, 0);
  if (!cert || cert.tag !== SEQUENCE) return null;
  const tbs = readTlv(der, cert.start);
  if (!tbs || tbs.tag !== SEQUENCE) return null;

  let field = readTlv(der, tbs.start);
  if (field?.tag === VERSION_TAG) field = readTlv(der, field.end);
  // serialNumber → signature → issuer → validity
  for (let skip = 0; skip < 3 && field; skip++) field = readTlv(der, field.end);
  if (!field || field.tag !== SEQUENCE) return null;

  const notBefore = readTlv(der, field.start);
  if (!notBefore) return null;
  const notAfter = readTlv(der, notBefore.end);
  if (!notAfter || notAfter.end > field.end) return null;
  if (notAfter.tag !== UTC_TIME && notAfter.tag !== GENERALIZED_TIME) return null;
  return parseTime(der, notAfter);
}
