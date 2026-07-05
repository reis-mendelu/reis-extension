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
    useAppStore.setState({ adminLogin, enterSocietyMode, adminRole: 'association' });
    render(<SocietyLoginForm />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@supef.cz' } });
    fireEvent.change(screen.getByLabelText('Heslo'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Přihlásit' }));
    await waitFor(() => expect(enterSocietyMode).toHaveBeenCalledOnce());
    expect(adminLogin).toHaveBeenCalledWith('admin@supef.cz', 'x');
  });
});
