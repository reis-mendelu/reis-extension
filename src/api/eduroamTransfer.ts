// Desktop side of the zero-knowledge eduroam transfer. Uploads ONLY the encrypted
// payload (iv‖ciphertext) to Supabase via the put_eduroam_transfer RPC; the AES key
// is never sent here — it goes only into the QR URL fragment (see buildTransferUrl).
// The phone fetches + burns the ciphertext through take_eduroam_transfer, served by
// the eduroam-receive edge function.

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { bytesToBase64 } from '@/services/eduroam/base64';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/** Phone-side receiver page (HTTPS → secure context for Web Crypto). */
export const RECEIVER_URL = `${SUPABASE_URL}/functions/v1/eduroam-receive`;

/**
 * Upload the encrypted transfer payload (one-time, short-TTL). Throws on failure.
 * `payload` is `iv‖ciphertext‖tag` from encryptProfile — never the plaintext profile.
 */
export async function putTransfer(
  id: string,
  payload: Uint8Array,
  ttlSeconds = 480,
): Promise<void> {
  const { error } = await supabase.rpc('put_eduroam_transfer', {
    p_id: id,
    p_payload: bytesToBase64(payload),
    p_ttl_seconds: ttlSeconds,
  });
  if (error) throw new Error(`eduroam transfer upload failed: ${error.message}`);
}

/**
 * The QR target: receiver page + transfer id in the query and the AES key in the
 * fragment. The fragment is never transmitted to any server, keeping the key
 * out of the request the phone makes for the ciphertext.
 */
export function buildTransferUrl(id: string, keyB64url: string): string {
  return `${RECEIVER_URL}?id=${encodeURIComponent(id)}#${keyB64url}`;
}
