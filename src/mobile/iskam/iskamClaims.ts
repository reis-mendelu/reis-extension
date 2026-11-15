import { parseClaims, type Claim } from './claimsParser';
import { jarGeneration, loadJar, saveJar } from './iskamCookieStore';
import { iskamHop, type IskamHttpDeps } from './iskamHttp';
import { ISKAM_ORIGIN } from './iskamJar';
import { isAuthRedirect } from './iskamSession';

export type ClaimsRead = Claim[] | null | 'expired';

/**
 * The open claims, one GET of /InformaceOKlientovi. null = cannot tell (a
 * failure or a page without the table); 'expired' = WebISKAM sent us to log in.
 *
 * `persist: false` is for the read started ALONGSIDE the silent chain, so the
 * claim shows as soon as the balance does (two sequential WebISKAM pages
 * were 1–2 s, measured 2026-11-15). That read must not save the jar: the chain
 * may be re-authenticating at the same moment, and a save here would bump the
 * jar generation and make the chain's fresh login be thrown away.
 */
export async function fetchClaims(
  http: IskamHttpDeps,
  opts: { persist: boolean } = { persist: true }
): Promise<ClaimsRead> {
  const gen = jarGeneration();
  const jar = await loadJar();
  const { res, jar: next } = await iskamHop(http, jar, `${ISKAM_ORIGIN}/InformaceOKlientovi`);
  if (opts.persist) await saveJar(next, gen);
  if (isAuthRedirect(res)) return 'expired';
  return res.status === 200 ? parseClaims(res.body) : null;
}
