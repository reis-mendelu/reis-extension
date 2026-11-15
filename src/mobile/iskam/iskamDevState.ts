import type { IskamState } from './iskamStore';

/**
 * `?iskam=balance|claim|claim-short|added|unseen|signed-out|checking|unavailable` on the dev webapp, and
 * nothing anywhere else — `import.meta.env.DEV` strips it from every shipped
 * build, like `?eduroam=` in eduroamNative. The row is Capacitor-gated, so
 * without this verify-ui could only ever report it absent.
 */
export function devForcedState(): Partial<IskamState> | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('iskam');
  if (v === 'balance') return { status: 'balance', balance: { amount: 2825.58 } };
  if (v === 'claim' || v === 'claim-short') {
    const claims = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        due: '2026-11-20',
        description: 'Ubytování 31.10.2026 - 30.11.2026',
        remaining: 5370,
      },
    ];
    return { status: 'balance', balance: { amount: v === 'claim' ? 6940.16 : 2825.58 }, claims };
  }
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
