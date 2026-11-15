import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';

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
import { useIskamStore } from '../../../../mobile/iskam/iskamStore';
import type { IskamState } from '../../../../mobile/iskam/iskamTypes';
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

  it('checking: screen readers hear that the balance is loading', () => {
    setState({ status: 'checking' });
    render(<IskamBalanceRow />);
    expect(screen.getByRole('status')).toHaveTextContent('Načítám zůstatek');
  });

  // Dominik, 2026-10-24: after paying it was not explicit whether money was
  // added, and the top-up form stayed open.
  it('after a credited top-up: says how much was added and closes the form', () => {
    setState({ status: 'balance', balance: { amount: 100 } });
    render(<IskamBalanceRow />);
    fireEvent.click(screen.getByRole('button', { name: 'Dobít' }));
    expect(screen.getByText('Částka (Kč)')).toBeTruthy();
    act(() => setState({ balance: { amount: 350 }, lastTopUp: { kind: 'added', amount: 250 } }));
    expect(screen.getByRole('status')).toHaveTextContent('Dobito +250,00 Kč');
    expect(screen.queryByText('Částka (Kč)')).toBeNull();
    // Dobít again: a fresh form, the old result gone.
    fireEvent.click(screen.getByRole('button', { name: 'Dobít' }));
    expect(screen.getByText('Částka (Kč)')).toBeTruthy();
    expect(screen.queryByText(/Dobito/)).toBeNull();
  });

  it('when the balance has not moved: says so honestly and leaves the form', () => {
    setState({ status: 'balance', balance: { amount: 100 } });
    render(<IskamBalanceRow />);
    fireEvent.click(screen.getByRole('button', { name: 'Dobít' }));
    act(() => setState({ lastTopUp: { kind: 'unseen' } }));
    expect(screen.getByRole('status')).toHaveTextContent('Zůstatek se zatím nezměnil');
    expect(screen.getByText('Částka (Kč)')).toBeTruthy();
  });

  it('an open claim: its amount and due date, and Zaplatit opens WebISKAM for it', () => {
    const payClaim = vi.fn(async () => {});
    const id = '00000000-0000-0000-0000-000000000001';
    setState({
      status: 'balance',
      balance: { amount: 6940.16 },
      claims: [
        {
          id,
          due: '2026-11-20',
          description: 'Ubytování 31.10.2026 - 30.11.2026',
          remaining: 5370,
        },
      ],
      payClaim,
    });
    render(<IskamBalanceRow />);
    const claims = screen.getByTestId('iskam-claims');
    expect(claims).toHaveTextContent('Ubytování 31.10.2026 - 30.11.2026');
    expect(claims).toHaveTextContent(/5\s370\sKč.*splatné do 20\. 11\./);
    fireEvent.click(screen.getByRole('button', { name: 'Zaplatit' }));
    expect(payClaim).toHaveBeenCalledWith(id);
  });

  it('a claim the balance does not cover: Zaplatit disabled, and how much to top up', () => {
    setState({
      status: 'balance',
      balance: { amount: 2825.58 },
      claims: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          due: '2026-11-20',
          description: 'Ubytování',
          remaining: 5370,
        },
      ],
    });
    render(<IskamBalanceRow />);
    expect(screen.getByRole('button', { name: 'Zaplatit' })).toBeDisabled();
    expect(screen.getByTestId('iskam-claims')).toHaveTextContent(/chybí 2\s545,00\s*Kč/);
  });

  it('no claims row without claims', () => {
    setState({ status: 'balance', balance: { amount: 10 }, claims: [] });
    render(<IskamBalanceRow />);
    expect(screen.queryByTestId('iskam-claims')).toBeNull();
  });

  it('says Zaplaceno beside a claim that is still open', () => {
    setState({
      status: 'balance',
      balance: { amount: 100 },
      claims: [
        {
          id: '00000000-0000-0000-0000-000000000002',
          due: '2026-12-20',
          description: 'Ubytování 30.11.2026 - 31.12.2026',
          remaining: 5370,
        },
      ],
      lastClaimPaid: { amount: 5370 },
    });
    render(<IskamBalanceRow />);
    expect(screen.getByRole('status')).toHaveTextContent(/Zaplaceno 5\s370\sKč/);
    expect(screen.getByTestId('iskam-claims')).toHaveTextContent('30.11.2026');
  });
});
