import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { useAppStore } from '../../../store/useAppStore';
import { AdminConsole } from '../AdminConsole';

// The console mounts a real MapCanvas on desktop. Leaflet needs a laid-out DOM
// that jsdom does not provide, and none of these assertions are about the map,
// so stub the pane out.
vi.mock('../AdminConsoleMap', () => ({ AdminConsoleMap: () => <div data-testid="console-map" /> }));

const SESSION = { user: { email: 'admin@supef.cz' } } as unknown as Session;

const loggedIn = (over: Partial<ReturnType<typeof useAppStore.getState>> = {}) =>
  useAppStore.setState({
    language: 'cz',
    adminConsoleOpen: true,
    adminSession: SESSION,
    adminRole: 'association',
    adminAssociationId: 'supef',
    adminActiveAssociationId: 'supef',
    societyMapEvents: [],
    composerOpen: false,
    isTouch: false,
    isNarrow: false,
    ...over,
  });

describe('AdminConsole', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      adminSession: null,
      adminRole: null,
      adminAssociationId: null,
      adminActiveAssociationId: null,
      adminConsoleOpen: true,
      societyMapEvents: [],
      composerOpen: false,
      isTouch: false,
      isNarrow: false,
      devPhoneOverride: null,
    });
  });

  it('shows the login screen when there is no admin session', () => {
    render(<AdminConsole />);
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-console')).toBeNull();
  });

  // A student who clicks the button out of curiosity must not be trapped behind
  // a credentials prompt.
  it('lets you leave from the login screen without signing in', () => {
    const closeSocietyAdmin = vi.fn();
    useAppStore.setState({ closeSocietyAdmin });
    render(<AdminConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Zpět do reIS' }));
    expect(closeSocietyAdmin).toHaveBeenCalledTimes(1);
  });

  it('shows the console once a session exists', () => {
    loggedIn();
    render(<AdminConsole />);
    expect(screen.getByTestId('admin-console')).toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail')).toBeNull();
  });

  it('shows a fixed society chip for an association, with no picker', () => {
    loggedIn();
    render(<AdminConsole />);
    expect(screen.getByText('SU PEF')).toBeInTheDocument();
    expect(screen.queryByLabelText('Vyberte spolek')).toBeNull();
  });

  it('gives a reIS admin a society picker instead', () => {
    loggedIn({ adminRole: 'reis_admin', adminAssociationId: null, adminActiveAssociationId: null });
    render(<AdminConsole />);
    expect(screen.getByLabelText('Vyberte spolek')).toBeInTheDocument();
  });

  it('switching society in the picker sets the active association', () => {
    const setActiveAssociation = vi.fn();
    loggedIn({
      adminRole: 'reis_admin',
      adminAssociationId: null,
      adminActiveAssociationId: null,
      setActiveAssociation,
    });
    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText('Vyberte spolek'), { target: { value: 'esn' } });
    expect(setActiveAssociation).toHaveBeenCalledWith('esn');
  });

  it('"Zpět do reIS" leaves the console and logout is a separate action', () => {
    const closeSocietyAdmin = vi.fn();
    const adminLogout = vi.fn(async () => {});
    loggedIn({ closeSocietyAdmin, adminLogout });
    render(<AdminConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Zpět do reIS' }));
    expect(closeSocietyAdmin).toHaveBeenCalledTimes(1);
    expect(adminLogout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Odhlásit' }));
    expect(adminLogout).toHaveBeenCalledTimes(1);
  });

  it('renders the phone stack on a narrow touch viewport', () => {
    loggedIn({ isTouch: true, isNarrow: true });
    render(<AdminConsole />);
    expect(screen.getByTestId('admin-console-mobile')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-console')).toBeNull();
  });
});
