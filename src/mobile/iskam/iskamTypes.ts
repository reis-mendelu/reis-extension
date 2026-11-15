import type { Claim } from './claimsParser';
import type { KontoBalance } from './kontaParser';
import type { PayMethod } from './topUp';

/** The ISIC row's state and its parts; the store itself is iskamStore.ts. */
export type IskamStatus = 'hidden' | 'checking' | 'signed-out' | 'balance' | 'unavailable';
export type TopUpPhase = 'idle' | 'starting' | 'paying' | 'failed';
/**
 * What the last top-up came to, as far as the balance can tell: `added` when
 * it rose (by that much), `unseen` when it had not moved after the re-check —
 * which is also what closing GoPay without paying looks like.
 */
export type TopUpResult = { kind: 'added'; amount: number } | { kind: 'unseen' };

export interface IskamState {
  status: IskamStatus;
  balance: KontoBalance | null;
  signingIn: boolean;
  topUp: TopUpPhase;
  lastTopUp: TopUpResult | null;
  /** Open claims (pohledávky); null = not read or cannot tell. */
  claims: Claim[] | null;
  /** WebISKAM's pay page is open for a claim. */
  payingClaim: boolean;
  /**
   * The claim WebISKAM's page was opened for is gone after the re-check: it
   * was paid (WebISKAM itself says nothing). What it was, to say "Zaplaceno".
   */
  lastClaimPaid: { amount: number } | null;
  check(): Promise<void>;
  /** Opens WebISKAM's own pay dialog for the claim; the student pays there. */
  payClaim(id: string): Promise<void>;
  signIn(): Promise<void>;
  startTopUp(amount: number, method: PayMethod): Promise<void>;
  /** Dobít pressed again after a credited top-up: the old result goes. */
  clearTopUpResult(): void;
  reset(): void;
  /** Sign-out: like reset, and also abandons a top-up in flight. */
  signOut(): void;
}
