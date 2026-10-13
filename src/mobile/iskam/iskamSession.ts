import { logError } from '../../utils/reportError';
import { clearJar, jarGeneration, loadJar, saveJar } from './iskamCookieStore';
import { iskamHop, type IskamHttpDeps, type IskamResponse } from './iskamHttp';
import { IDP_HOST, ISKAM_HOST, ISKAM_ORIGIN, TICKET_COOKIE, type IskamJar } from './iskamJar';
import { findSamlPostForm, hasPasswordForm } from './samlForm';

export type ChainResult =
  { state: 'live'; kontaHtml: string } | { state: 'dead' } | { state: 'unreachable' };

const KONTA = `${ISKAM_ORIGIN}/Konta`;
const AUTH_SHIBB = `${ISKAM_ORIGIN}/Prihlaseni/AuthShibb`;
const SP_ENDPOINT = `${ISKAM_ORIGIN}/Shibboleth.sso/`;
const MAX_HOPS = 10;

export function isLiveKonta(res: IskamResponse): boolean {
  return res.status === 200 && res.body.includes('vyskaRiadkuKonto');
}

/** WebISKAM never says 401: a lapsed login is a 302 to /Home/Index or the IdP. */
export function isAuthRedirect(res: IskamResponse): boolean {
  if (res.status < 300 || res.status >= 400 || !res.location) return false;
  const u = new URL(res.location);
  return u.hostname === IDP_HOST || /^\/(Home\/Index|Prihlaseni|Shibboleth\.sso)/i.test(u.pathname);
}

type Outcome = 'ok' | 'dead' | 'unreachable';

/**
 * AuthShibb, and wherever it leads, until webiskam issues a ticket.
 *
 * With a live SP session that is ONE hop (measured, ~0.5 s). Without one it
 * bounces through alibaba: a live IdP session answers with a SAMLResponse form
 * a browser would auto-submit — posted here by hand, and only to webiskam's own
 * Shibboleth endpoint — and a dead one with the password form, which is where
 * this stops. It never types anything into it.
 */
async function reauthenticate(
  http: IskamHttpDeps,
  start: IskamJar
): Promise<{ jar: IskamJar; outcome: Outcome }> {
  let jar = start;
  let req: { url: string; method: 'GET' | 'POST'; body?: string } = {
    url: AUTH_SHIBB,
    method: 'GET',
  };
  for (let i = 0; i < MAX_HOPS; i++) {
    const hop = await iskamHop(http, jar, req.url, { method: req.method, body: req.body });
    jar = hop.jar;
    const { res } = hop;
    const host = new URL(res.url).hostname;
    if (host === ISKAM_HOST && res.setCookieNames.includes(TICKET_COOKIE)) {
      return { jar, outcome: 'ok' };
    }
    if (res.status >= 300 && res.status < 400 && res.location) {
      const next = new URL(res.location).hostname;
      if (next !== ISKAM_HOST && next !== IDP_HOST) return { jar, outcome: 'dead' };
      req = { url: res.location, method: 'GET' };
      continue;
    }
    if (res.status === 200 && host === IDP_HOST) {
      if (hasPasswordForm(res.body)) return { jar, outcome: 'dead' };
      const form = findSamlPostForm(res.body, res.url);
      if (form && form.action.startsWith(SP_ENDPOINT)) {
        req = { url: form.action, method: 'POST', body: form.body };
        continue;
      }
      if (form) return { jar, outcome: 'dead' };
    }
    // A 5xx, an IdP error page, something new: not proof the login is gone.
    return { jar, outcome: 'unreachable' };
  }
  return { jar, outcome: 'unreachable' };
}

/**
 * Is the stored WebISKAM login still good — and if not, can it be made good
 * without the student? Cheapest step first: the ticket, then the SP session,
 * then the IdP session. See the spec's "Silent chain".
 *
 * Only an AUTHENTICATION answer (the password form, a SAML hand-off to a
 * stranger) clears the stored jar. A network error, a timeout or a 5xx keeps
 * it, so bad wi-fi never costs the student their login.
 *
 * Every write is based on the generation read at the start, so a sign-out or a
 * fresh popup login that lands mid-chain wins over whatever this finds.
 */
export async function runSilentChain(http: IskamHttpDeps): Promise<ChainResult> {
  const gen = jarGeneration();
  let jar = await loadJar();
  if (jar.length === 0) return { state: 'dead' };
  try {
    let konta = await iskamHop(http, jar, KONTA);
    jar = konta.jar;
    if (isLiveKonta(konta.res)) {
      await saveJar(jar, gen);
      return { state: 'live', kontaHtml: konta.res.body };
    }
    if (!isAuthRedirect(konta.res)) {
      await saveJar(jar, gen);
      return { state: 'unreachable' };
    }
    const re = await reauthenticate(http, jar);
    jar = re.jar;
    if (re.outcome === 'dead') {
      await clearJar(gen);
      return { state: 'dead' };
    }
    if (re.outcome === 'unreachable') {
      await saveJar(jar, gen);
      return { state: 'unreachable' };
    }
    konta = await iskamHop(http, jar, KONTA);
    jar = konta.jar;
    await saveJar(jar, gen);
    return isLiveKonta(konta.res)
      ? { state: 'live', kontaHtml: konta.res.body }
      : { state: 'unreachable' };
  } catch (e) {
    logError('Iskam.silentChain', e);
    return { state: 'unreachable' };
  }
}
