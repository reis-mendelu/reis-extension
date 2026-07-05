import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SocietyAdminOverlay } from '../SocietyAdminOverlay';

describe('SocietyAdminOverlay', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'en', adminOverlayOpen: false, adminSession: null, adminRole: null, adminAssociationId: null });
  });
  it('renders nothing when closed', () => {
    const { container } = render(<SocietyAdminOverlay />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the login form when open and logged out', () => {
    useAppStore.setState({ adminOverlayOpen: true });
    render(<SocietyAdminOverlay />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });
});
