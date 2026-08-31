import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SocietyAccountsPanel } from '../SocietyAccountsPanel';

const resetSocietyPassword = vi.fn();
const listSocietyAccounts = vi.fn();
const createSocietyAccount = vi.fn();
vi.mock('../../../api/societyAccounts', () => ({
  resetSocietyPassword: (...a: unknown[]) => resetSocietyPassword(...a),
  listSocietyAccounts: (...a: unknown[]) => listSocietyAccounts(...a),
  createSocietyAccount: (...a: unknown[]) => createSocietyAccount(...a),
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

  it('creates a society and shows its password once', async () => {
    createSocietyAccount.mockResolvedValueOnce({ password: 'Fresh2345Pass6789Xyz' });
    render(<SocietyAccountsPanel />);

    fireEvent.change(await screen.findByLabelText('Název spolku'), {
      target: { value: 'esn' },
    });
    fireEvent.change(screen.getByLabelText('Zobrazovaný název'), {
      target: { value: 'ESN Mendelu' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vytvořit účet' }));

    expect(await screen.findByText('Fresh2345Pass6789Xyz')).toBeInTheDocument();
    expect(createSocietyAccount).toHaveBeenCalledWith('esn', 'ESN Mendelu');
  });

  it('keeps create disabled until both fields are filled', async () => {
    render(<SocietyAccountsPanel />);
    const button = await screen.findByRole('button', { name: 'Vytvořit účet' });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Název spolku'), { target: { value: 'esn' } });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Zobrazovaný název'), {
      target: { value: 'ESN Mendelu' },
    });
    expect(button).toBeEnabled();
  });
});
