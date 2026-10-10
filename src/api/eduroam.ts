// Fetches the student's eduroam certificate material directly from the
// authenticated IS Mendelu session (the iframe can fetch is.mendelu.cz with
// credentials, same as file downloads). All assembly stays client-side; the
// private key is never sent anywhere. See src/services/eduroam for the generator.

const CERT_URL = 'https://is.mendelu.cz/auth/wifi/certifikat.pl';

import { fetchWithAuth, fetchAuthedBytes } from './client';
import { certNotAfter } from '../services/eduroam/certValidity';
import { logError } from '../utils/reportError';

export interface EduroamCertMaterial {
  /** MENDELU root CA, DER bytes (also the server-validation anchor). */
  rootCaDer: Uint8Array;
  /** The student's personal PKCS#12 (cert + private key) bytes. */
  clientP12: Uint8Array;
  /** Extraction password shown on the cert page (needed to install the .p12). */
  password: string | null;
  /** True when no cert existed and a fresh one had to be generated. */
  generated: boolean;
  /**
   * The certificate's notAfter, read from the certificate itself; null when it
   * could not be read. IS keeps offering an expired certificate and does not
   * replace it on its own, so this is how the UI knows to offer a new one.
   */
  expiresAt: Date | null;
}

/**
 * Parse the cert page HTML: whether a usable certificate exists (its download
 * links are present) and the extraction password (shown as `heslo <b>X</b>` /
 * `password <b>X</b>`). Pure and testable — no network.
 */
export function parseCertPage(html: string): { hasCert: boolean; password: string | null } {
  const hasCert = /certifikat\.pl\?get=user-p12/i.test(html);
  const m = html.match(/(?:heslo|password)\s*<b>\s*([^<\s][^<]*?)\s*<\/b>/i);
  return { hasCert, password: m ? m[1].trim() : null };
}

async function getText(url: string): Promise<string> {
  const res = await fetchWithAuth(url);
  if (!res.ok) throw new Error(`eduroam: GET ${url} -> ${res.status}`);
  return res.text();
}

/**
 * Read just the extraction password from the cert page — no .p12 download, no
 * generation. Returns null when no certificate exists yet (a fresh cert and its
 * password only appear once fetchEduroamCertMaterial generates one). Lets the UI
 * show the password before the student clicks Download.
 */
export async function fetchEduroamPassword(): Promise<string | null> {
  return parseCertPage(await getText(`${CERT_URL}?lang=cz`)).password;
}

/**
 * Ask IS for a new certificate. Exported for the one caller allowed to use it:
 * the student's own "generate a new certificate" tap, offered only once the
 * current one has expired — at which point it is dead on every device anyway.
 */
export async function regenerateEduroamCert(): Promise<void> {
  // The only IS write left in reIS, now that the calendar-sync writer is gone,
  // and it stays student-initiated because it is a write to the student's IS
  // account. It does NOT revoke anything: an older certificate stays valid on
  // the devices that have it until its own expiry (observed 2026-09, a
  // regeneration left the previous certificate working). Each one is valid
  // for 366 days from the moment it is generated.
  //
  // No explicit Content-Type. Both transports already supply it, and adding a
  // differently-cased copy DOUBLED it: DEFAULT_HEADERS uses lowercase
  // `content-type`, both keys survive client.ts's object spread, and `Headers`
  // appends rather than replaces — so IS received
  // `application/x-www-form-urlencoded, application/x-www-form-urlencoded`,
  // failed to parse the body, and no certificate was ever created.
  const res = await fetchWithAuth(CERT_URL, {
    method: 'POST',
    body: `lang=cz&gen=${encodeURIComponent('Vygenerovat certifikát')}`,
  });
  if (!res.ok) throw new Error(`eduroam: generate -> ${res.status}`);
}

/**
 * Fetch the student's eduroam cert material from the live IS session. If no
 * certificate exists yet, generate one first, then download. Reuses an existing
 * cert when present so devices already using it keep working.
 */
export async function fetchEduroamCertMaterial(): Promise<EduroamCertMaterial> {
  let { hasCert, password } = parseCertPage(await getText(`${CERT_URL}?lang=cz`));
  let generated = false;

  if (!hasCert) {
    await regenerateEduroamCert();
    ({ hasCert, password } = parseCertPage(await getText(`${CERT_URL}?lang=cz`)));
    generated = true;
    if (!hasCert) throw new Error('eduroam: certificate generation did not produce a certificate');
  }

  const [rootCaDer, clientP12, expiresAt] = await Promise.all([
    fetchAuthedBytes(`${CERT_URL}?get=root-der;lang=cz`),
    fetchAuthedBytes(`${CERT_URL}?get=user-p12;lang=cz`),
    fetchExpiry(),
  ]);

  return { rootCaDer, clientP12, password, generated, expiresAt };
}

/**
 * notAfter of the student's certificate, from IS's bare DER copy of it. Fails
 * open: the check only adds information, so an unreadable answer is "unknown"
 * and setup goes on exactly as it did before the check existed.
 */
async function fetchExpiry(): Promise<Date | null> {
  try {
    const der = await fetchAuthedBytes(`${CERT_URL}?get=user-der;lang=cz`);
    return certNotAfter(der);
  } catch (e) {
    logError('Api.fetchEduroamExpiry', e);
    return null;
  }
}
