import { parseClaims, type Claim } from './claimsParser';
import { jarGeneration, loadJar, saveJar } from './iskamCookieStore';
import { iskamHop, type IskamHttpDeps } from './iskamHttp';
import { ISKAM_ORIGIN } from './iskamJar';

/**
 * The open claims, read right after a live /Konta in the same check — so the
 * session is fresh and this is one GET. Any failure is null ("cannot tell"),
 * and the balance row simply shows no claim: a claim is extra, never in the
 * way of the balance.
 */
export async function fetchClaims(http: IskamHttpDeps): Promise<Claim[] | null> {
  const gen = jarGeneration();
  const jar = await loadJar();
  const { res, jar: next } = await iskamHop(http, jar, `${ISKAM_ORIGIN}/InformaceOKlientovi`);
  await saveJar(next, gen);
  return res.status === 200 ? parseClaims(res.body) : null;
}
