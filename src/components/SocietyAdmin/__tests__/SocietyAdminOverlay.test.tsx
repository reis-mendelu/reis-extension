import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SocietyAdminOverlay } from '../SocietyAdminOverlay';

describe('SocietyAdminOverlay', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'en',
      adminOverlayOpen: false,
      adminSession: null,
      adminRole: null,
      adminAssociationId: null,
    });
  });
  it('renders nothing when closed', () => {
    const { container } = render(<SocietyAdminOverlay />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the login form when open and logged out', () => {
    useAppStore.setState({ adminOverlayOpen: true, adminSession: null, language: 'cz' });
    render(<SocietyAdminOverlay />);
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });
  it('shows the reis-admin note (not a post manager) for a reis_admin session', () => {
    useAppStore.setState({
      adminOverlayOpen: true,
      adminSession: { user: { email: 'reis.mendelu@gmail.com' } } as never,
      adminRole: 'reis_admin',
      language: 'cz',
    });
    render(<SocietyAdminOverlay />);
    expect(
      screen.getByText('Přihlášen jako reIS admin. Akce se spravují u konkrétního spolku.')
    ).toBeInTheDocument();
  });
  it('shows the suggestions inbox heading for a reis_admin session', () => {
    useAppStore.setState({
      adminOverlayOpen: true,
      adminSession: { user: { email: 'reis.mendelu@gmail.com' } } as never,
      adminRole: 'reis_admin',
      language: 'en',
    });
    render(<SocietyAdminOverlay />);
    expect(screen.getByRole('heading', { name: /student suggestions/i })).toBeInTheDocument();
  });
  it('hides the suggestions inbox but keeps the logout button for an association session with no association id', () => {
    useAppStore.setState({
      adminOverlayOpen: true,
      adminSession: { user: { email: 'someone@example.com' } } as never,
      adminRole: 'association',
      adminAssociationId: null,
      language: 'en',
    });
    render(<SocietyAdminOverlay />);
    expect(screen.queryByText(/suggestions/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log ?out/i })).toBeInTheDocument();
  });
});
