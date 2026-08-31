import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SocietyLoginForm } from '../SocietyLoginForm';

describe('SocietyLoginForm', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      adminSession: null,
      adminRole: null,
      adminAssociationId: null,
      adminActiveAssociationId: null,
    });
  });

  const fill = (username = 'supef', password = 'x') => {
    fireEvent.change(screen.getByLabelText('Název spolku'), { target: { value: username } });
    fireEvent.change(screen.getByLabelText('Heslo'), { target: { value: password } });
  };

  it('submits the entered credentials', async () => {
    const adminLogin = vi.fn(async () => ({}));
    useAppStore.setState({ adminLogin });
    render(<SocietyLoginForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit' }));
    await waitFor(() => expect(adminLogin).toHaveBeenCalledWith('supef', 'x'));
  });

  // There is nothing to navigate on success: AdminConsole renders this form only
  // while adminSession is null, so setting the session swaps it for the console.
  // The form must not try to route anywhere itself.
  it('shows the error message when login is rejected', async () => {
    useAppStore.setState({ adminLogin: vi.fn(async () => ({ error: 'invalid_credentials' })) });
    render(<SocietyLoginForm />);
    fill('supef', 'wrong');
    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit' }));
    expect(await screen.findByText('Neplatné jméno nebo heslo')).toBeInTheDocument();
  });

  it('surfaces the same error when adminLogin throws', async () => {
    useAppStore.setState({
      adminLogin: vi.fn(async () => {
        throw new Error('network down');
      }),
    });
    render(<SocietyLoginForm />);
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit' }));
    expect(await screen.findByText('Neplatné jméno nebo heslo')).toBeInTheDocument();
  });

  it('keeps submit disabled until both fields have content', () => {
    useAppStore.setState({ adminLogin: vi.fn(async () => ({})) });
    render(<SocietyLoginForm />);
    const submit = screen.getByRole('button', { name: 'Přihlásit' });
    expect(submit).toBeDisabled();
    fill('supef', '');
    expect(submit).toBeDisabled();
    fill();
    expect(submit).toBeEnabled();
  });

  it('submits on Enter (the iframe sandbox blocks native form submission)', async () => {
    const adminLogin = vi.fn(async () => ({}));
    useAppStore.setState({ adminLogin });
    render(<SocietyLoginForm />);
    fill();
    fireEvent.keyDown(screen.getByLabelText('Heslo'), { key: 'Enter' });
    await waitFor(() => expect(adminLogin).toHaveBeenCalledTimes(1));
  });
});
