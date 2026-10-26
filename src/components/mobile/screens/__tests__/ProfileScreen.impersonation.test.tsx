import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('../../../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto: () => null }));

beforeEach(() => useAppStore.setState({ language: 'cz', mobileSheets: [] }));

describe('ProfileScreen — view as a student', () => {
  it('is absent for everyone but a reis_admin', () => {
    useAppStore.setState({ adminRole: 'association' });
    render(<ProfileScreen />);
    expect(screen.queryByText('Zobrazit jako student…')).toBeNull();
  });

  it('for a reis_admin, opens the sheet and asks for the options', () => {
    const load = vi.fn(async () => {});
    useAppStore.setState({ adminRole: 'reis_admin', loadImpersonationOptions: load });
    render(<ProfileScreen />);
    fireEvent.click(screen.getByText('Zobrazit jako student…'));
    expect(load).toHaveBeenCalledOnce();
    expect(useAppStore.getState().mobileSheets.map((s) => s.kind)).toContain('impersonation');
  });
});
