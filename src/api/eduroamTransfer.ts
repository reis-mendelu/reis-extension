// Desktop side of the eduroam desktop→phone transfer (direct-install model).
// Uploads the (password-protected) .mobileconfig to a one-time, short-TTL Supabase
// row; the QR points straight at the eduroam-receive endpoint, which serves the
// profile with Content-Type application/x-apple-aspen-config so iOS Safari shows the
// install prompt directly — no page, no decrypt. Not zero-knowledge: Supabase briefly
// holds the profile. Safe because the .p12 password is never uploaded (typed at install).

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { bytesToBase64 } from '@/services/eduroam/base64';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/** Endpoint that serves the profile once (and burns it) for the phone to install. */
export const RECEIVER_URL = `${SUPABASE_URL}/functions/v1/eduroam-receive`;

/**
 * Upload the profile bytes to a fresh one-time row (short TTL). Returns the random
 * transfer id. The bytes are the password-protected profile — never the raw key.
 */
export async function putTransfer(profileBytes: Uint8Array, ttlSeconds = 480): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.rpc('put_eduroam_transfer', {
    p_id: id,
    p_payload: bytesToBase64(profileBytes),
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw new Error(`eduroam transfer upload failed: ${error.message}`);
  return id;
}

/** Which on-phone format the receiver should serve this transfer as. */
export type TransferFormat = 'ios' | 'android' | 'p12';

/**
 * The QR target: the receiver endpoint for this transfer id. `fmt` selects the
 * response MIME/filename on the receiver (`ios` = Apple config profile, the
 * default and unchanged; `android` = `.eap-config` for geteduroam; `p12` = the
 * raw password-protected PKCS#12 for the manual Android EAP-TLS path). The hint
 * is not a secret — the uploaded bytes are whatever was put for this id.
 */
export function buildTransferUrl(id: string, fmt: TransferFormat = 'ios'): string {
  const base = `${RECEIVER_URL}?id=${encodeURIComponent(id)}`;
  return fmt === 'ios' ? base : `${base}&fmt=${fmt}`;
}
