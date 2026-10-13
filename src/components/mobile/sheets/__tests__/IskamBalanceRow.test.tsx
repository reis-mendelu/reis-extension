import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../../mobile/iskam/iskamSession', () => ({ runSilentChain: vi.fn() }));
vi.mock('../../../../mobile/iskam/iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../../../../mobile/iskam/iskamTopUp', () => ({
  initTopUp: vi.fn(),
  openGateway: vi.fn(),
}));
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
    setState({ status: 'balance', balance: { amount: 1234.5 } });
    render(<IskamBalanceRow />);
    expect(screen.getByTestId('iskam-amount').textContent?.replace(/\s/g, ' ')).toBe('1 234,50 Kč');
    expect(screen.getByRole('button', { name: 'Dobít' })).toBeEnabled();
  });

  // The amount is formatted in the APP's language, never copied from the page:
  // WebISKAM answers in the phone's language, so a Czech UI would otherwise show
  // "1,234.50 Kč" to a student whose phone is set to English.
  it('formats the amount in the app language, not the page language', () => {
    useAppStore.setState({ language: 'en' } as never);
    setState({ status: 'balance', balance: { amount: 1234.5 } });
    render(<IskamBalanceRow />);
    expect(screen.getByTestId('iskam-amount')).toHaveTextContent(/1,234\.50/);
  });

  // index.css restyles .btn-primary outside any layer, which overrides
  // DaisyUI's disabled look — a disabled Dobít looked exactly like an enabled
  // one on the Pixel. Only opacity survives, so the dimming is ours to add.
  it('Dobít visibly dims until a balance is confirmed', () => {
    setState({ status: 'signed-out' });
    render(<IskamBalanceRow />);
    expect(screen.getByRole('button', { name: 'Dobít' })).toHaveClass('disabled:opacity-40');
  });

  it('Dobít opens the top-up form, and a second tap closes it', () => {
    setState({ status: 'balance', balance: { amount: 10 } });
    render(<IskamBalanceRow />);
    expect(screen.queryByLabelText('Částka (Kč)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Dobít' }));
    expect(screen.getByLabelText('Částka (Kč)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dobít' }));
    expect(screen.queryByLabelText('Částka (Kč)')).toBeNull();
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
