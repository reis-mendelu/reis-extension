import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpolkySection } from '../SpolkySection';
import { useAppStore } from '../../../../store/useAppStore';

const renderSection = (onNavigate = vi.fn()) => {
  render(
    <SpolkySection
      expanded
      onToggle={() => {}}
      isSub={() => false}
      onToggleAssoc={() => {}}
      onNavigate={onNavigate}
    />
  );
  return onNavigate;
};

describe('SpolkySection', () => {
  beforeEach(() => {
    useAppStore.setState({
      adminRole: null,
      adminAssociationId: null,
      adminActiveAssociationId: null,
      adminConsoleOpen: false,
    });
  });

  it('opens the admin console and closes the popover when clicked', () => {
    const openSocietyAdmin = vi.fn();
    useAppStore.setState({ openSocietyAdmin });
    const onNavigate = renderSection();
    fireEvent.click(screen.getByText('Spravovat spolky'));
    expect(openSocietyAdmin).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  // This button is the ONLY entrance to the admin console, so it must not
  // disappear or turn into something else once a session exists — logging out
  // is the console's job now.
  it('still shows the manage button when already logged in, and never a logout row', () => {
    useAppStore.setState({
      adminRole: 'association',
      adminAssociationId: 'reis',
      adminActiveAssociationId: 'reis',
    });
    renderSection();
    expect(screen.getByText('Spravovat spolky')).toBeTruthy();
    expect(screen.queryByText('Odhlásit')).toBeNull();
  });

  it('shows the same entrance to a reIS admin, who belongs to no society', () => {
    useAppStore.setState({
      adminRole: 'reis_admin',
      adminAssociationId: null,
      adminActiveAssociationId: null,
    });
    renderSection();
    expect(screen.getByText('Spravovat spolky')).toBeTruthy();
  });
});
