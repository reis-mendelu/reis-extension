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

export interface IskamState {
  status: IskamStatus;
  balance: KontoBalance | null;
  signingIn: boolean;
  topUp: TopUpPhase;
  check(): Promise<void>;
  signIn(): Promise<void>;
  startTopUp(amount: number, method: PayMethod): Promise<void>;
  reset(): void;
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

function available(): boolean {
  if (isDemoMode()) return false;
  try {
    return getPlatform().kind === 'capacitor';
  } catch {
    return false;
  }
}

/**
 * `?iskam=balance|signed-out|checking|unavailable` on the dev webapp, and
 * nothing anywhere else — `import.meta.env.DEV` strips it from every shipped
 * build, like `?eduroam=` in eduroamNative. The row is Capacitor-gated, so
 * without this verify-ui could only ever report it absent.
 */
function devForcedState(): Pick<IskamState, 'status' | 'balance'> | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('iskam');
  if (v === 'balance') return { status: 'balance', balance: { amount: 2825.58 } };
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
   * succeeded: closing the tab without paying looks exactly the same.
   */
  async startTopUp(amount, method) {
    const phase = get().topUp;
    if (phase === 'starting' || phase === 'paying' || !available()) return;
    set({ topUp: 'starting' });
    const before = get().balance?.amount ?? null;
    try {
      const http = await buildIskamHttpDeps();
      let init = await initTopUp(http, amount, method);
      if (init.kind === 'expired') {
        const chain = await runSilentChain(http);
        if (chain.state === 'dead') await signInToIskam(await buildIskamLoginDeps());
        else if (chain.state === 'unreachable') throw new Error('WebISKAM unreachable');
        init = await initTopUp(http, amount, method);
      }
      if (init.kind !== 'ok') throw new Error(`top-up init: ${init.kind}`);
      set({ topUp: 'paying' });
      await openGateway(init.url);
      // Still 'paying' through the re-checks: the form stays disabled until the
      // credit has had its chance to show, so a slow one cannot invite a
      // second order.
      await get().check();
      if (get().status === 'balance' && get().balance?.amount === before) {
        await delay(RECHECK_MS);
        await get().check();
      }
      set({ topUp: 'idle' });
    } catch (e) {
      if (e instanceof LoginCancelledError) {
        set({ topUp: 'idle' });
        return;
      }
      logError('Iskam.topUp', e);
      set({ topUp: 'failed' });
    }
  },

  reset() {
    seq++;
    // A top-up already starting or on the payment page outlives the sheet:
    // clearing its phase here let a reopened sheet start a second payment.
    const inFlight = get().topUp === 'starting' || get().topUp === 'paying';
    set({
      status: 'hidden',
      balance: null,
      signingIn: false,
      ...(inFlight ? {} : { topUp: 'idle' as const }),
    });
  },
}));
