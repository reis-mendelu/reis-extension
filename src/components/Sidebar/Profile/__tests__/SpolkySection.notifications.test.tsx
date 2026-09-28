import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SpolkySection } from '../SpolkySection';
import { useAppStore } from '../../../../store/useAppStore';
import { DEFAULT_PREFS } from '../../../../store/slices/createFollowSlice';
import { BUNDLED_SOCIETIES } from '../../../../data/societies';

vi.mock('../../../../services/eventReminders/sync', () => ({
  askNotificationPermission: vi.fn().mockResolvedValue('granted'),
}));

const esn = BUNDLED_SOCIETIES.esn!;
const supef = BUNDLED_SOCIETIES.supef!;
const catalog: Record<string, typeof esn> = { esn, supef };

const renderSection = (notifications?: boolean) =>
  render(
    <SpolkySection
      expanded
      onToggle={() => {}}
      isSub={(id) => id === 'esn'}
      onToggleAssoc={() => {}}
      notifications={notifications}
    />
  );

describe('SpolkySection notification bells', () => {
  beforeEach(() => {
    useAppStore.setState({
      adminRole: null,
      adminAssociationId: null,
      adminActiveAssociationId: null,
      adminConsoleOpen: false,
      societies: catalog,
      followed: ['esn'],
      muted: [],
      notifyPrefs: DEFAULT_PREFS,
      notifyPermission: 'granted',
      toggleMute: vi.fn(),
      setNotifyPref: vi.fn(),
      setNotifyPermission: vi.fn(),
      replanNotifications: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders no Oznámení group or bells without the notifications prop (desktop)', () => {
    renderSection();
    expect(screen.queryByText('Oznámení')).toBeNull();
    expect(screen.queryByLabelText('Ztlumit ESN MENDELU')).toBeNull();
  });

  it('renders the Oznámení group and a bell on the followed row when notifications is true', () => {
    renderSection(true);
    expect(screen.getByText('Oznámení')).toBeTruthy();
    // esn is followed (isSub returns true) -> gets a bell; supef is not.
    expect(screen.getByLabelText('Ztlumit ESN MENDELU')).toBeTruthy();
    expect(screen.queryByLabelText('Ztlumit SU PEF')).toBeNull();
  });

  it('the bell toggles mute and flips its label/aria-pressed', () => {
    const toggleMute = vi.fn();
    useAppStore.setState({ toggleMute });
    renderSection(true);
    const bell = screen.getByLabelText('Ztlumit ESN MENDELU');
    expect(bell.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(bell);
    expect(toggleMute).toHaveBeenCalledWith('esn');
  });

  it('shows the unmute label once the society is muted', () => {
    useAppStore.setState({ muted: ['esn'] });
    renderSection(true);
    const bell = screen.getByLabelText('Zrušit ztlumení ESN MENDELU');
    expect(bell.getAttribute('aria-pressed')).toBe('true');
  });
});
