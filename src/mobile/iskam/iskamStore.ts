import { create } from 'zustand';
import { isDemoMode } from '../../errors/demoMode';
import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';
import { LoginCancelledError } from '../ensureSession';
import { buildIskamHttpDeps } from './iskamHttp';
import { buildIskamLoginDeps, signInToIskam } from './iskamLogin';
import { runSilentChain, type ChainResult } from './iskamSession';
import { initTopUp, openGateway } from './iskamTopUp';
import { parseHlavniKonto, type KontoBalance } from './kontaParser';
import type { PayMethod } from './topUp';

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
  check(): Promise<void>;
  signIn(): Promise<void>;
  startTopUp(amount: number, method: PayMethod): Promise<void>;
  /** Dobít pressed again after a credited top-up: the old result goes. */
  clearTopUpResult(): void;
  reset(): void;
  /** Sign-out: like reset, and also abandons a top-up in flight. */
  signOut(): void;
}

/** One more look at the balance when it has not moved yet after the payment page closed. */
export const RECHECK_MS = 3000;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The ISIC row's state. A store of its own, NOT a slice of useAppStore: the
 * extension builds useAppStore too, and WebISKAM must not reach it in any form
 * (#247; src/test/guards/desktopHasNoIskam.test.ts).
 *
 * The balance lives here and nowhere else — memory only, and only from the
 * latest successful /Konta. Every check starts by dropping it, so a student
 * never sees a number WebISKAM did not just confirm.
 */
let seq = 0;
/** Bumped by signOut(); a top-up that sees it change stops where it is. */
let account = 0;
/** Bumped by reset() (the sheet went away); a payment that sees it change skips its balance re-read. */
let sheet = 0;

function available(): boolean {
  if (isDemoMode()) return false;
  try {
    return getPlatform().kind === 'capacitor';
  } catch {
    return false;
  }
}

/**
 * `?iskam=balance|added|unseen|signed-out|checking|unavailable` on the dev webapp, and
 * nothing anywhere else — `import.meta.env.DEV` strips it from every shipped
 * build, like `?eduroam=` in eduroamNative. The row is Capacitor-gated, so
 * without this verify-ui could only ever report it absent.
 */
function devForcedState(): Partial<IskamState> | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('iskam');
  if (v === 'balance') return { status: 'balance', balance: { amount: 2825.58 } };
  // After a top-up: credited, or not showing yet.
  if (v === 'added') {
    const lastTopUp = { kind: 'added', amount: 250 } as const;
    return { status: 'balance', balance: { amount: 3075.58 }, lastTopUp };
  }
  if (v === 'unseen') {
    return { status: 'balance', balance: { amount: 2825.58 }, lastTopUp: { kind: 'unseen' } };
  }
  if (v === 'signed-out' || v === 'checking' || v === 'unavailable') {
    return { status: v, balance: null };
  }
  return null;
}

function fromChain(r: ChainResult): Pick<IskamState, 'status' | 'balance'> {
  if (r.state === 'dead') return { status: 'signed-out', balance: null };
  if (r.state === 'unreachable') return { status: 'unavailable', balance: null };
  const balance = parseHlavniKonto(r.kontaHtml);
  return balance ? { status: 'balance', balance } : { status: 'unavailable', balance: null };
}

export const useIskamStore = create<IskamState>()((set, get) => ({
  status: 'hidden',
  balance: null,
  signingIn: false,
  topUp: 'idle',
  lastTopUp: null,

  async check() {
    const forced = devForcedState();
    if (forced) {
      set(forced);
      return;
    }
    if (!available()) {
      set({ status: 'hidden', balance: null });
      return;
    }
    const mine = ++seq;
    set({ status: 'checking', balance: null });
    const result = await runSilentChain(await buildIskamHttpDeps());
    if (mine !== seq) return;
    set(fromChain(result));
  },

  async signIn() {
    if (get().signingIn || !available()) return;
    set({ signingIn: true });
    try {
      await signInToIskam(await buildIskamLoginDeps());
      set({ signingIn: false });
      await get().check();
    } catch (e) {
      if (e instanceof LoginCancelledError) {
        set({ signingIn: false, status: 'signed-out', balance: null });
      } else {
        logError('Iskam.signIn', e);
        set({ signingIn: false, status: 'unavailable', balance: null });
      }
    }
  },

  /**
   * Dobít. Init first — Dobít is only enabled beside a balance WebISKAM just
   * confirmed, so the session is almost always live — and only on an
   * "expired" answer run the chain (and the popup if it is dead) and init once
   * more. After the browser view closes the balance is re-read; WebISKAM says
   * gateway payments are credited at once, but if the number has not moved it
   * is read once more after RECHECK_MS. The app never claims the payment
   * succeeded: it reports what the balance did (`lastTopUp`), and closing the
   * tab without paying looks exactly like a credit that has not shown yet.
   */
  async startTopUp(amount, method) {
    const phase = get().topUp;
    if (phase === 'starting' || phase === 'paying' || !available()) return;
    set({ topUp: 'starting', lastTopUp: null });
    const before = get().balance?.amount ?? null;
    const mine = account;
    const openSheet = sheet;
    const abandoned = () => mine !== account;
    try {
      const http = await buildIskamHttpDeps();
      let init = await initTopUp(http, amount, method);
      if (init.kind === 'expired') {
        const chain = await runSilentChain(http);
        if (chain.state === 'dead') await signInToIskam(await buildIskamLoginDeps());
        else if (chain.state === 'unreachable') throw new Error('WebISKAM unreachable');
        init = await initTopUp(http, amount, method);
      }
      // Signed out meanwhile: never open the previous student's payment page.
      if (abandoned()) return;
      if (init.kind !== 'ok') throw new Error(`top-up init: ${init.kind}`);
      set({ topUp: 'paying' });
      await openGateway(init.url);
      if (abandoned()) return;
      if (openSheet !== sheet) {
        // The sheet closed while the student paid: nothing shows a balance now,
        // so it is not fetched into memory. Reopening checks afresh.
        set({ topUp: 'idle' });
        return;
      }
      // Still 'paying' through the re-checks: the form stays disabled until the
      // credit has had its chance to show, so a slow one cannot invite a
      // second order.
      await get().check();
      if (get().status === 'balance' && get().balance?.amount === before) {
        await delay(RECHECK_MS);
        await get().check();
      }
      const after = get().status === 'balance' ? (get().balance?.amount ?? null) : null;
      const lastTopUp: TopUpResult | null =
        after === null || before === null
          ? null
          : after > before
            ? { kind: 'added', amount: after - before }
            : { kind: 'unseen' };
      set({ topUp: 'idle', lastTopUp });
    } catch (e) {
      if (abandoned()) return;
      if (e instanceof LoginCancelledError) {
        set({ topUp: 'idle' });
        return;
      }
      logError('Iskam.topUp', e);
      set({ topUp: 'failed' });
    }
  },

  clearTopUpResult() {
    set({ lastTopUp: null });
  },

  reset() {
    seq++;
    sheet++;
    // A top-up already starting or on the payment page outlives the sheet:
    // clearing its phase here let a reopened sheet start a second payment.
    const inFlight = get().topUp === 'starting' || get().topUp === 'paying';
    set({
      status: 'hidden',
      balance: null,
      signingIn: false,
      lastTopUp: null,
      ...(inFlight ? {} : { topUp: 'idle' as const }),
    });
  },

  signOut() {
    account++;
    seq++;
    set({ status: 'hidden', balance: null, signingIn: false, topUp: 'idle', lastTopUp: null });
  },
}));
