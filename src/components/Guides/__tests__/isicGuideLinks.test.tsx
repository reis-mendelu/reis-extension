import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => 'ios' },
}));
vi.mock('../../../mobile/iskam/iskamSession', () => ({ runSilentChain: vi.fn() }));
vi.mock('../../../mobile/iskam/iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../../../mobile/iskam/iskamLogin', () => ({
  signInToIskam: vi.fn(),
  buildIskamLoginDeps: async () => ({}),
}));
vi.mock('../../../mobile/iskam/iskamTopUp', () => ({ initTopUp: vi.fn(), openGateway: vi.fn() }));

import { IskamBalanceRow } from '../../mobile/sheets/IskamBalanceRow';
import { IskamTopUpForm } from '../../mobile/sheets/IskamTopUpForm';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';
import { useAppStore } from '../../../store/useAppStore';

const OFFICIAL = 'https://reisapp.cz/navody/dobiti-isic?z=app&utm_source=reis-app#oficialne';

/** ISIC (phone only): when reIS cannot do it, the guide's official way. */
describe('ISIC — Jiný postup', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    useIskamStore.getState().reset();
  });
  afterEach(cleanup);

  it('links it when the balance cannot be read', () => {
    useIskamStore.setState({ status: 'unavailable' });
    render(<IskamBalanceRow />);
    expect(screen.getByRole('link', { name: 'Jiný postup' })).toHaveAttribute('href', OFFICIAL);
  });

  it('not beside a confirmed balance', () => {
    useIskamStore.setState({ status: 'balance', balance: { amount: 120 } as never });
    render(<IskamBalanceRow />);
    expect(screen.queryByRole('link', { name: 'Jiný postup' })).toBeNull();
  });

  it('links it when a top-up could not start', () => {
    useIskamStore.setState({ topUp: 'failed' });
    render(<IskamTopUpForm />);
    expect(screen.getByRole('link', { name: 'Jiný postup' })).toHaveAttribute('href', OFFICIAL);
  });

  it('not before anything has failed', () => {
    useIskamStore.setState({ topUp: 'idle' });
    render(<IskamTopUpForm />);
    expect(screen.queryByRole('link', { name: 'Jiný postup' })).toBeNull();
  });
});
