import { logError } from '../../utils/reportError';
import type { Claim } from './claimsParser';
import { fetchClaims } from './iskamClaims';
import type { IskamHttpDeps } from './iskamHttp';
import { openClaimInIskam } from './iskamPayClaim';
import type { IskamState } from './iskamTypes';

/**
 * The claims half of a balance check, started BEFORE the silent chain so the
 * claim shows with the balance instead of a second wait later (two WebISKAM
 * pages one after another were 1–2 s, measured 2026-11-15). `settle()` after
 * the chain: when the early read met an expired login (the chain logged in
 * again meanwhile), it reads once more, this time saving the jar.
 */
export function beginClaimsRead(http: IskamHttpDeps): { settle(): Promise<Claim[] | null> } {
  const read = (persist: boolean) =>
    fetchClaims(http, { persist }).catch((e: unknown) => {
      logError('Iskam.fetchClaims', e);
      return null;
    });
  const early = read(false);
  return {
    async settle() {
      let claims = await early;
      if (claims === 'expired') claims = await read(true);
      return claims === 'expired' ? null : claims;
    },
  };
}

export interface PayClaimContext {
  claims(): Claim[] | null;
  set(p: Partial<Pick<IskamState, 'payingClaim' | 'lastClaimPaid'>>): void;
  check(): Promise<void>;
  /** False once the student signed out since Zaplatit. */
  sameAccount(): boolean;
  /** False once the sheet went away since Zaplatit. */
  sameSheet(): boolean;
}

/**
 * Zaplatit beside a claim. reIS only opens WebISKAM's page with its own dialog
 * up; whether the student pays is theirs and WebISKAM's. Afterwards the
 * balance and claims are read again, and "Zaplaceno" is said only when
 * WebISKAM's own page no longer lists the claim — never assumed.
 */
export async function payClaimFlow(id: string, ctx: PayClaimContext): Promise<void> {
  const claim = ctx.claims()?.find((c) => c.id === id) ?? null;
  ctx.set({ payingClaim: true, lastClaimPaid: null });
  try {
    await openClaimInIskam(id);
  } catch (e) {
    logError('Iskam.payClaim', e);
  }
  if (!ctx.sameAccount()) return;
  ctx.set({ payingClaim: false });
  if (!ctx.sameSheet()) return;
  await ctx.check();
  if (!ctx.sameAccount() || !ctx.sameSheet()) return;
  const after = ctx.claims();
  if (claim && after !== null && !after.some((c) => c.id === id)) {
    ctx.set({ lastClaimPaid: { amount: claim.remaining } });
  }
}
