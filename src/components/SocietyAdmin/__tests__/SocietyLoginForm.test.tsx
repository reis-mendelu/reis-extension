import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SocietyLoginForm } from '../SocietyLoginForm';

describe('SocietyLoginForm', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', adminRole: null, adminAssociationId: null });
  });

  it('enters society mode after a successful association login', async () => {
    const adminLogin = vi.fn(async () => ({}));
    const enterSocietyMode = vi.fn();
    useAppStore.setState({
      adminLogin,
      enterSocietyMode,
      adminRole: 'association',
      adminAssociationId: 'supef',
    });
    render(<SocietyLoginForm />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@supef.cz' } });
    fireEvent.change(screen.getByLabelText('Heslo'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit' }));
    await waitFor(() => expect(enterSocietyMode).toHaveBeenCalledOnce());
    expect(adminLogin).toHaveBeenCalledWith('admin@supef.cz', 'x');
  });

  it('does not enter society mode for a reis_admin login', async () => {
    const adminLogin = vi.fn(async () => {
      useAppStore.setState({ adminRole: 'reis_admin' });
      return {};
    });
    const enterSocietyMode = vi.fn();
    useAppStore.setState({ adminLogin, enterSocietyMode });
    render(<SocietyLoginForm />);
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'admin@reis.mendelu.cz' },
    });
    fireEvent.change(screen.getByLabelText('Heslo'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit' }));
    await waitFor(() => expect(adminLogin).toHaveBeenCalledOnce());
    expect(enterSocietyMode).not.toHaveBeenCalled();
  });

  it('does not enter society mode for an association login with a null association id', async () => {
    const adminLogin = vi.fn(async () => ({}));
    const enterSocietyMode = vi.fn();
    useAppStore.setState({
      adminLogin,
      enterSocietyMode,
      adminRole: 'association',
      adminAssociationId: null,
    });
    render(<SocietyLoginForm />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@supef.cz' } });
    fireEvent.change(screen.getByLabelText('Heslo'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit' }));
    await waitFor(() => expect(adminLogin).toHaveBeenCalledOnce());
    expect(enterSocietyMode).not.toHaveBeenCalled();
  });
});
