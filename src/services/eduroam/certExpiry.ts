// Minimal ASN.1 DER walker that pulls `notAfter` out of an X.509 certificate.
// Deliberately tiny: it only navigates Certificate → tbsCertificate → validity
// → notAfter, enough to learn when the MENDELU client cert expires so the
// generated eduroam profiles can advertise a real expiry. Not a general X.509
// parser — do not extend it into one.

interface Tlv {
  tag: number;
  valueStart: number;
  end: number;
}

function readTlv(der: Uint8Array, pos: number): Tlv {
  if (pos + 1 > der.length) throw new Error('certExpiry: truncated TLV');
  const tag = der[pos];
  let i = pos + 1;
  let len = der[i++];
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error('certExpiry: unsupported length form');
    len = 0;
    for (let k = 0; k < n; k++) len = (len << 8) | der[i++];
  }
  const end = i + len;
  if (end > der.length) throw new Error('certExpiry: length exceeds buffer');
  return { tag, valueStart: i, end };
}

function parseAsn1Time(tag: number, bytes: Uint8Array): Date {
  const s = new TextDecoder().decode(bytes);
  let year: number;
  let rest: string;
  if (tag === 0x17) {
    // UTCTime: YYMMDDHHMMSSZ — RFC 5280 pivots the 2-digit year at 50.
    const yy = parseInt(s.slice(0, 2), 10);
    year = yy >= 50 ? 1900 + yy : 2000 + yy;
    rest = s.slice(2);
  } else if (tag === 0x18) {
    // GeneralizedTime: YYYYMMDDHHMMSSZ
    year = parseInt(s.slice(0, 4), 10);
    rest = s.slice(4);
  } else {
    throw new Error(`certExpiry: unexpected time tag 0x${tag.toString(16)}`);
  }
  const month = parseInt(rest.slice(0, 2), 10);
  const day = parseInt(rest.slice(2, 4), 10);
  const hour = parseInt(rest.slice(4, 6), 10);
  const minute = parseInt(rest.slice(6, 8), 10);
  const second = /^\d\d/.test(rest.slice(8, 10)) ? parseInt(rest.slice(8, 10), 10) : 0;
  const t = Date.UTC(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(t)) throw new Error('certExpiry: unparseable time');
  return new Date(t);
}

/**
 * Extract the `notAfter` timestamp from a DER-encoded X.509 certificate.
 * Throws if the structure is not a recognizable certificate.
 */
export function parseCertNotAfter(der: Uint8Array): Date {
  const cert = readTlv(der, 0); // Certificate ::= SEQUENCE
  if (cert.tag !== 0x30) throw new Error('certExpiry: not a certificate SEQUENCE');
  const tbs = readTlv(der, cert.valueStart); // tbsCertificate ::= SEQUENCE
  if (tbs.tag !== 0x30) throw new Error('certExpiry: missing tbsCertificate');

  let p = tbs.valueStart;
  const first = readTlv(der, p);
  if (first.tag === 0xa0) p = first.end; // [0] EXPLICIT version (v2/v3) — skip
  p = readTlv(der, p).end; // serialNumber INTEGER
  p = readTlv(der, p).end; // signature AlgorithmIdentifier SEQUENCE
  p = readTlv(der, p).end; // issuer Name SEQUENCE

  const validity = readTlv(der, p); // validity ::= SEQUENCE { notBefore, notAfter }
  if (validity.tag !== 0x30) throw new Error('certExpiry: missing validity');
  const notBefore = readTlv(der, validity.valueStart);
  const notAfter = readTlv(der, notBefore.end);
  return parseAsn1Time(notAfter.tag, der.subarray(notAfter.valueStart, notAfter.end));
}

/**
 * Extract the subject Common Name (CN) from a DER-encoded X.509 certificate.
 * For the MENDELU client cert this is `<login>@mendelu.cz` — exactly the value
 * the student must type into Android's EAP-TLS "Identity" field. Returns null if
 * no CN is present. Throws only if the bytes aren't a certificate.
 */
export function parseCertSubjectCN(der: Uint8Array): string | null {
  const cert = readTlv(der, 0);
  if (cert.tag !== 0x30) throw new Error('certExpiry: not a certificate SEQUENCE');
  const tbs = readTlv(der, cert.valueStart);
  if (tbs.tag !== 0x30) throw new Error('certExpiry: missing tbsCertificate');

  let p = tbs.valueStart;
  const first = readTlv(der, p);
  if (first.tag === 0xa0) p = first.end; // [0] version
  p = readTlv(der, p).end; // serialNumber
  p = readTlv(der, p).end; // signature
  p = readTlv(der, p).end; // issuer
  p = readTlv(der, p).end; // validity
  const subject = readTlv(der, p); // subject Name ::= SEQUENCE OF RDN
  if (subject.tag !== 0x30) throw new Error('certExpiry: missing subject');

  // Walk each RDN (SET) → AttributeTypeAndValue (SEQUENCE { OID, value }); the CN
  // attribute type OID id-at-commonName = 2.5.4.3 encodes to bytes 55 04 03.
  let q = subject.valueStart;
  while (q < subject.end) {
    const rdn = readTlv(der, q);
    let a = rdn.valueStart;
    while (a < rdn.end) {
      const atv = readTlv(der, a);
      const oid = readTlv(der, atv.valueStart);
      const ob = der.subarray(oid.valueStart, oid.end);
      if (ob.length === 3 && ob[0] === 0x55 && ob[1] === 0x04 && ob[2] === 0x03) {
        const val = readTlv(der, oid.end);
        return new TextDecoder().decode(der.subarray(val.valueStart, val.end));
      }
      a = atv.end;
    }
    q = rdn.end;
  }
  return null;
}

/**
 * Format a Date for the eduroam `.eap-config` `<ValidUntil>` element.
 * geteduroam's AndroidConfigParser binds Date with
 * `SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss")` in UTC, so we must match that
 * exactly (no trailing `Z`, no milliseconds). The result is also a valid
 * `xs:dateTime`, so it still passes eap-metadata.xsd validation.
 */
export function formatValidUntil(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
  );
}
