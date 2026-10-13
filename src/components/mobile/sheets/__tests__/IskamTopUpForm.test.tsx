import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

let platform = 'android';
vi.mock('@capacitor/core', async (orig) => ({
  ...(await orig<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => platform },
}));
vi.mock('../../../../mobile/iskam/iskamSession', () => ({ runSilentChain: vi.fn() }));
vi.mock('../../../../mobile/iskam/iskamHttp', () => ({ buildIskamHttpDeps: async () => ({}) }));
vi.mock('../../../../mobile/iskam/iskamLogin', () => ({
  signInToIskam: vi.fn(),
  buildIskamLoginDeps: async () => ({}),
}));
vi.mock('../../../../mobile/iskam/iskamTopUp', () => ({
  initTopUp: vi.fn(),
  openGateway: vi.fn(),
}));

import { IskamTopUpForm } from '../IskamTopUpForm';
import { useIskamStore } from '../../../../mobile/iskam/iskamStore';
import { useAppStore } from '../../../../store/useAppStore';

describe('IskamTopUpForm', () => {
  const startTopUp = vi.fn(async (_amount: number, _method: 'card' | 'gpay') => {});
  beforeEach(() => {
    platform = 'android';
    startTopUp.mockClear();
    useAppStore.setState({ language: 'cz' } as never);
    useIskamStore.setState({ topUp: 'idle', startTopUp });
  });
  afterEach(cleanup);

  it('keeps both pay buttons disabled until the amount is valid', () => {
    render(<IskamTopUpForm />);
    expect(screen.getByRole('button', { name: 'Zaplatit kartou' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Částka (Kč)'), { target: { value: '15001' } });
    expect(screen.getByText('Zadej celé číslo od 1 do 15 000 Kč')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google Pay' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Částka (Kč)'), { target: { value: '250' } });
    expect(screen.getByRole('button', { name: 'Zaplatit kartou' })).toBeEnabled();
  });

  it('both pay buttons share the tonal style and dim when disabled', () => {
    render(<IskamTopUpForm />);
    for (const name of ['Google Pay', 'Zaplatit kartou']) {
      const b = screen.getByRole('button', { name });
      expect(b).toHaveClass('btn-primary');
      expect(b).toHaveClass('disabled:opacity-40');
    }
  });

  it('pays with the parsed amount and the chosen method', () => {
    render(<IskamTopUpForm />);
    fireEvent.change(screen.getByLabelText('Částka (Kč)'), { target: { value: '1 500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Google Pay' }));
    expect(startTopUp).toHaveBeenCalledWith(1500, 'gpay');
  });

  it('has no Google Pay button on iOS', () => {
    platform = 'ios';
    render(<IskamTopUpForm />);
    expect(screen.queryByRole('button', { name: 'Google Pay' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Zaplatit kartou' })).toBeInTheDocument();
  });

  it('shows the failure message after a failed start', () => {
    useIskamStore.setState({ topUp: 'failed' });
    render(<IskamTopUpForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('Platbu se nepodařilo zahájit');
  });
});
