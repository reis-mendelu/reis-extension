import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../../mobile/iskam/iskamSession', () => ({ runSilentChain: vi.fn() }));
vi.mock('../../../../mobile/iskam/iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../../../../mobile/iskam/iskamLogin', () => ({
  signInToIskam: vi.fn(),
  buildIskamLoginDeps: async () => ({}),
}));

import { IskamBalanceRow } from '../IskamBalanceRow';
import { useIskamStore, type IskamState } from '../../../../mobile/iskam/iskamStore';
import { useAppStore } from '../../../../store/useAppStore';

const setState = (p: Partial<IskamState>) => useIskamStore.setState(p);

describe('IskamBalanceRow', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    useIskamStore.getState().reset();
  });
  afterEach(cleanup);

  it('renders nothing while hidden (demo mode, extension, dev webapp)', () => {
    const { container } = render(<IskamBalanceRow />);
    expect(container).toBeEmptyDOMElement();
  });

  it('checking: a skeleton in place of the amount, Dobít disabled', () => {
    setState({ status: 'checking' });
    render(<IskamBalanceRow />);
    expect(screen.getByTestId('iskam-skeleton')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeDisabled();
  });

  it('signed-out: "Zobrazit zůstatek ISIC" opens the popup; Dobít disabled', () => {
    const signIn = vi.fn(async () => {});
    setState({ status: 'signed-out', signIn });
    render(<IskamBalanceRow />);
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit zůstatek ISIC' }));
    expect(signIn).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeDisabled();
  });

  it('balance: the amount and an enabled Dobít', () => {
    setState({ status: 'balance', balance: { amount: 245, text: '245,00 Kč' } });
    render(<IskamBalanceRow />);
    expect(screen.getByText('245,00 Kč')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeEnabled();
  });

  it('unavailable: a retry, no amount, Dobít disabled', () => {
    const check = vi.fn(async () => {});
    setState({ status: 'unavailable', check });
    render(<IskamBalanceRow />);
    fireEvent.click(screen.getByRole('button', { name: 'Zůstatek teď nejde načíst' }));
    expect(check).toHaveBeenCalled();
    expect(screen.queryByText(/Kč/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeDisabled();
  });
});
