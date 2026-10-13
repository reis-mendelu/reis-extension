import { create } from 'zustand';
import { isDemoMode } from '../../errors/demoMode';
import { getPlatform } from '../../platform';
import { logError } from '../../utils/reportError';
import { LoginCancelledError } from '../ensureSession';
import { buildIskamHttpDeps } from './iskamHttp';
import { buildIskamLoginDeps, signInToIskam } from './iskamLogin';
import { runSilentChain, type ChainResult } from './iskamSession';
import { parseHlavniKonto, type KontoBalance } from './kontaParser';

export type IskamStatus = 'hidden' | 'checking' | 'signed-out' | 'balance' | 'unavailable';
export type TopUpPhase = 'idle' | 'starting' | 'paying' | 'failed';

export interface IskamState {
  status: IskamStatus;
  balance: KontoBalance | null;
  signingIn: boolean;
  topUp: TopUpPhase;
  check(): Promise<void>;
  signIn(): Promise<void>;
  reset(): void;
}

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

  reset() {
    seq++;
    set({ status: 'hidden', balance: null, signingIn: false, topUp: 'idle' });
  },
}));
