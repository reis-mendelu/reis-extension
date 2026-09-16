import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SocietyAccountsPanel } from '../SocietyAccountsPanel';

const resetSocietyPassword = vi.fn();
const listSocietyAccounts = vi.fn();
const createSocietyAccount = vi.fn();
vi.mock('../../../api/societyAccounts', () => ({
  resetSocietyPassword: (...a: unknown[]) => resetSocietyPassword(...a),
  listSocietyAccounts: (...a: unknown[]) => listSocietyAccounts(...a),
  createSocietyAccount: (...a: unknown[]) => createSocietyAccount(...a),
}));

const supef = {
  association_id: 'supef',
  association_name: 'SUPEF',
  is_active: true,
  email: 'supef@societies.invalid',
};

beforeEach(() => {
  vi.clearAllMocks();
  // The panel reads the accounts from the store; the slice is what fetches them
  // (on login / session restore and after a create). Seed the store directly.
  useAppStore.setState({ language: 'cz', adminAssociationId: 'reis', societyAccounts: [supef] });
  listSocietyAccounts.mockResolvedValue([supef]);
});

/**
 * The panel as a CREDENTIAL screen: what to sign in as, and which account a
 * freshly issued password belongs to. Split from SocietyAccountsPanel.test.tsx
 * to keep both within the project's 200-line convention.
 */
describe('SocietyAccountsPanel — credentials', () => {
  // Dominik: "we can reset the passwords, but I just forgot the login". The
  // login is read off the account's stored address (see loginFromAuthEmail)
  // and it was nowhere in this panel, so the one screen that hands
  // out credentials never said which account they were for.
  it('shows each account its login name', async () => {
    useAppStore.setState({
      societyAccounts: [
        {
          association_id: 'au_frrms',
          association_name: 'AU FRRMS',
          is_active: true,
          email: 'au_frrms@societies.invalid',
        },
        {
          association_id: 'usaf',
          association_name: 'USAF',
          is_active: true,
          email: 'usaf@societies.invalid',
        },
      ],
    });
    render(<SocietyAccountsPanel />);

    const row = await screen.findByRole('button', { name: /AU FRRMS/ });
    expect(within(row).getByText('login: au_frrms')).toBeInTheDocument();
    const other = screen.getByRole('button', { name: /USAF/ });
    expect(within(other).getByText('login: usaf')).toBeInTheDocument();
  });

  it('names the account a reset password belongs to', async () => {
    resetSocietyPassword.mockResolvedValueOnce({ password: 'Abcd2345Efgh6789Jkmn' });
    render(<SocietyAccountsPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /SUPEF/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Obnovit heslo' }));

    const dialog = await screen.findByRole('dialog');
    // Both halves of the credential, together, at the only moment the password
    // exists — it is shown once and then gone.
    expect(within(dialog).getByText('Abcd2345Efgh6789Jkmn')).toBeInTheDocument();
    expect(within(dialog).getByText('supef')).toBeInTheDocument();
  });

  it('names the account a newly created password belongs to', async () => {
    createSocietyAccount.mockResolvedValueOnce({ password: 'Fresh2345Pass6789Xyz' });
    render(<SocietyAccountsPanel />);

    fireEvent.change(await screen.findByLabelText('Název spolku'), { target: { value: 'esn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vytvořit účet' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Fresh2345Pass6789Xyz')).toBeInTheDocument();
    expect(within(dialog).getByText('esn')).toBeInTheDocument();
  });

  // Greptile on #335. societyLogin.ts keeps a documented break-glass exception:
  // an address with "@" passes through, so an admin account can hold a REAL
  // mailbox while its association_id stays short. Deriving the login from the
  // id would print "reis2" for an account that signs in as a gmail address —
  // the one thing this feature exists to prevent.
  it('shows the real mailbox when an account does not use the synthetic domain', async () => {
    useAppStore.setState({
      societyAccounts: [
        {
          association_id: 'reis2',
          association_name: 'REIS team 2',
          is_active: true,
          email: 'reis.mendelu@gmail.com',
        },
      ],
    });
    render(<SocietyAccountsPanel />);

    const row = await screen.findByRole('button', { name: /REIS team 2/ });
    expect(within(row).getByText('login: reis.mendelu@gmail.com')).toBeInTheDocument();
    expect(within(row).queryByText('login: reis2')).not.toBeInTheDocument();
  });
});
