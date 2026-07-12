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
    // Default: logged out — the section offers the "manage" (login) entry point.
    useAppStore.setState({ adminRole: null, adminAssociationId: null });
  });

  it('calls onNavigate (closes the popover) when "Spravovat spolek" is clicked', () => {
    const onNavigate = renderSection();
    fireEvent.click(screen.getByText('Spravovat spolek'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('shows logout instead of manage when logged in as a society, and logs out', () => {
    const adminLogout = vi.fn(async () => {});
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'reis', adminLogout });
    const onNavigate = renderSection();
    // The manage/login entry is replaced by a logout action.
    expect(screen.queryByText('Spravovat spolek')).toBeNull();
    fireEvent.click(screen.getByText('Odhlásit'));
    expect(adminLogout).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
