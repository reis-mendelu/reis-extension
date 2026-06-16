// Fetches the student's eduroam certificate material directly from the
// authenticated IS Mendelu session (the iframe can fetch is.mendelu.cz with
// credentials, same as file downloads). All assembly stays client-side; the
// private key is never sent anywhere. See src/services/eduroam for the generator.

const CERT_URL = 'https://is.mendelu.cz/auth/wifi/certifikat.pl';

export interface EduroamCertMaterial {
  /** MENDELU root CA, DER bytes (also the server-validation anchor). */
  rootCaDer: Uint8Array;
  /** The student's personal PKCS#12 (cert + private key) bytes. */
  clientP12: Uint8Array;
  /** Extraction password shown on the cert page (needed to install the .p12). */
  password: string | null;
  /** True when no cert existed and a fresh one had to be generated. */
  generated: boolean;
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
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`eduroam: GET ${url} -> ${res.status}`);
  return res.text();
}

async function getBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`eduroam: GET ${url} -> ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('text/html')) throw new Error('eduroam: expected certificate bytes, got HTML (session expired?)');
  return new Uint8Array(await res.arrayBuffer());
}

async function generateCert(): Promise<void> {
  const res = await fetch(CERT_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
    await generateCert();
    ({ hasCert, password } = parseCertPage(await getText(`${CERT_URL}?lang=cz`)));
    generated = true;
    if (!hasCert) throw new Error('eduroam: certificate generation did not produce a certificate');
  }

  const [rootCaDer, clientP12] = await Promise.all([
    getBytes(`${CERT_URL}?get=root-der;lang=cz`),
    getBytes(`${CERT_URL}?get=user-p12;lang=cz`),
  ]);

  return { rootCaDer, clientP12, password, generated };
}
