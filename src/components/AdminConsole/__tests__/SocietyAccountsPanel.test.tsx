import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SocietyAccountsPanel } from '../SocietyAccountsPanel';

const resetSocietyPassword = vi.fn();
const listSocietyAccounts = vi.fn();
vi.mock('../../../api/societyAccounts', () => ({
  resetSocietyPassword: (...a: unknown[]) => resetSocietyPassword(...a),
  listSocietyAccounts: (...a: unknown[]) => listSocietyAccounts(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  listSocietyAccounts.mockResolvedValue([
    { association_id: 'supef', association_name: 'SUPEF', is_active: true },
  ]);
});

describe('SocietyAccountsPanel', () => {
  it('shows the generated password once and drops it on close', async () => {
    resetSocietyPassword.mockResolvedValueOnce({ password: 'Abcd2345Efgh6789Jkmn' });
    render(<SocietyAccountsPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'SUPEF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Obnovit heslo' }));

    expect(await screen.findByText('Abcd2345Efgh6789Jkmn')).toBeInTheDocument();
    expect(resetSocietyPassword).toHaveBeenCalledWith('supef');

    fireEvent.click(screen.getByRole('button', { name: 'Zavřít' }));
    await waitFor(() =>
      expect(screen.queryByText('Abcd2345Efgh6789Jkmn')).not.toBeInTheDocument()
    );
  });

  it('surfaces an error without showing a password', async () => {
    resetSocietyPassword.mockResolvedValueOnce({ error: 'forbidden' });
    render(<SocietyAccountsPanel />);

    fireEvent.click(await screen.findByRole('button', { name: 'SUPEF' }));
    fireEvent.click(screen.getByRole('button', { name: 'Obnovit heslo' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
