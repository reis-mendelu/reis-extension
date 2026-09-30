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

  it('a switch never asks for permission once granted', () => {
    setup('granted', vi.fn(), { ...DEFAULT_PREFS, newEvents: false });
    fireEvent.click(screen.getByLabelText('Nové akce'));
    expect(askNotificationPermission).not.toHaveBeenCalled();
  });

  // Controller ruling: before the OS has been answered, three switches would
  // each have to double as the permission prompt. One explicit button asks
  // instead, and the switches appear once there is something for them to do.
  it.each(['prompt', 'prompt-with-rationale'] as const)(
    'shows one Turn-on button instead of the switches while %s',
    (permission) => {
      setup(permission);
      const button = screen.getByRole('button', { name: 'Zapnout oznámení' });
      expect(button.className).toContain('btn');
      expect(button.className).toContain('btn-primary');
      expect(button.className).toContain('btn-sm');
      expect(screen.queryByLabelText('Nové akce')).toBeNull();
      expect(screen.queryByLabelText('Připomínky mých akcí')).toBeNull();
      expect(screen.queryByLabelText('Akce sledovaných spolků')).toBeNull();
    }
  );

  it('the Turn-on button asks, records the answer and replans', async () => {
    askNotificationPermission.mockResolvedValue('denied');
    const { setNotifyPermission, replanNotifications, setNotifyPref } = setup('prompt');
    fireEvent.click(screen.getByRole('button', { name: 'Zapnout oznámení' }));
    await waitFor(() => expect(setNotifyPermission).toHaveBeenCalledWith('denied'));
    expect(askNotificationPermission).toHaveBeenCalledTimes(1);
    expect(replanNotifications).toHaveBeenCalled();
    expect(setNotifyPref).not.toHaveBeenCalled();
  });

  it.each(['unsupported', null] as const)('renders nothing while permission is %s', (p) => {
    setup(p);
    expect(screen.queryByText('Oznámení')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText('Nové akce')).toBeNull();
  });

  it('replaces the switches with an explanatory line when denied', () => {
    setup('denied');
    expect(screen.getByText('Oznámení jsou vypnutá v nastavení telefonu.')).toBeTruthy();
    expect(screen.queryByLabelText('Nové akce')).toBeNull();
    expect(screen.queryByLabelText('Připomínky mých akcí')).toBeNull();
    expect(screen.queryByLabelText('Akce sledovaných spolků')).toBeNull();
  });
});
