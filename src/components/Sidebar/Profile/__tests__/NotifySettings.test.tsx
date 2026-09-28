import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../../store/useAppStore';
import { DEFAULT_PREFS } from '../../../../store/slices/createFollowSlice';
import type { NotifyPermission } from '../../../../store/slices/createFollowSlice';

const askNotificationPermission = vi.fn();
vi.mock('../../../../services/eventReminders/sync', () => ({
  askNotificationPermission: (...a: unknown[]) => askNotificationPermission(...a),
}));

import { NotifySettings } from '../NotifySettings';

function setup(
  notifyPermission: NotifyPermission,
  setNotifyPref = vi.fn(),
  notifyPrefs = DEFAULT_PREFS
) {
  const setNotifyPermission = vi.fn();
  const replanNotifications = vi.fn();
  useAppStore.setState({
    notifyPrefs,
    notifyPermission,
    setNotifyPref,
    setNotifyPermission,
    replanNotifications,
  });
  render(<NotifySettings />);
  return { setNotifyPref, setNotifyPermission, replanNotifications };
}

describe('NotifySettings', () => {
  beforeEach(() => {
    askNotificationPermission.mockReset().mockResolvedValue('granted');
  });

  afterEach(() => {
    cleanup();
  });

  it('shows three toggles reflecting notifyPrefs', () => {
    setup('granted');
    const myEvents = screen.getByLabelText('Připomínky mých akcí') as HTMLInputElement;
    const followedEvents = screen.getByLabelText('Akce sledovaných spolků') as HTMLInputElement;
    const newEvents = screen.getByLabelText('Nové akce') as HTMLInputElement;
    expect(myEvents.checked).toBe(true);
    expect(followedEvents.checked).toBe(true);
    expect(newEvents.checked).toBe(true);
    expect(myEvents.className).toContain('toggle');
    expect(myEvents.className).toContain('toggle-sm');
  });

  it('toggling a switch calls setNotifyPref', () => {
    const { setNotifyPref } = setup('granted');
    fireEvent.click(screen.getByLabelText('Nové akce'));
    expect(setNotifyPref).toHaveBeenCalledWith('newEvents', false);
  });

  it('turning a switch ON while permission is prompt also asks permission once', async () => {
    // newEvents starts false so the click is unambiguously "turning ON".
    const { setNotifyPermission, replanNotifications } = setup('prompt', vi.fn(), {
      ...DEFAULT_PREFS,
      newEvents: false,
    });
    fireEvent.click(screen.getByLabelText('Nové akce'));
    await waitFor(() => expect(askNotificationPermission).toHaveBeenCalledTimes(1));
    expect(setNotifyPermission).toHaveBeenCalledWith('granted');
    expect(replanNotifications).toHaveBeenCalled();
  });

  it('does not ask permission when turning a switch off', () => {
    setup('prompt');
    fireEvent.click(screen.getByLabelText('Nové akce'));
    expect(askNotificationPermission).not.toHaveBeenCalled();
  });

  it('does not ask permission when already granted', () => {
    setup('granted', vi.fn(), { ...DEFAULT_PREFS, newEvents: false });
    fireEvent.click(screen.getByLabelText('Nové akce'));
    expect(askNotificationPermission).not.toHaveBeenCalled();
  });

  it('replaces the switches with an explanatory line when denied', () => {
    setup('denied');
    expect(screen.getByText('Oznámení jsou vypnutá v nastavení telefonu.')).toBeTruthy();
    expect(screen.queryByLabelText('Nové akce')).toBeNull();
    expect(screen.queryByLabelText('Připomínky mých akcí')).toBeNull();
    expect(screen.queryByLabelText('Akce sledovaných spolků')).toBeNull();
  });
});
