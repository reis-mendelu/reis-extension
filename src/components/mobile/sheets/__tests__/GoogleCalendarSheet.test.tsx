import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { connect, disconnect } = vi.hoisted(() => ({
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(async () => {}),
}));
vi.mock('../../../../mobile/googleCalendar/controller', () => ({
  connectGoogleCalendar: () => connect(),
  disconnectGoogleCalendar: () => disconnect(),
}));

import { GoogleCalendarSheet } from '../GoogleCalendarSheet';
import { useAppStore } from '../../../../store/useAppStore';

const OFF = {
  available: true,
  connected: false,
  email: null,
  syncing: false,
  progress: null,
  lastSyncAt: null,
  notice: null,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ language: 'cz' } as never);
  useAppStore.getState().setGcal(OFF);
});
afterEach(cleanup);

describe('GoogleCalendarSheet', () => {
  it('offers connect when off', () => {
    render(<GoogleCalendarSheet onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Zapnout synchronizaci/ }));
    expect(connect).toHaveBeenCalled();
  });

  it('shows the account and turns off with one tap, keeping the calendar', () => {
    useAppStore
      .getState()
      .setGcal({ connected: true, email: 'reis.mendelu@gmail.com', lastSyncAt: Date.now() });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    expect(screen.getByText('Účet: reis.mendelu@gmail.com')).toBeTruthy();
    // Dominik, 2026-10-08: on and off only — no "delete the calendar" here.
    expect(screen.queryByText(/smazat/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Vypnout synchronizaci/ }));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('explains a deleted calendar', () => {
    useAppStore.getState().setGcal({ notice: 'calendarGone' });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    expect(screen.getByText(/byl v Googlu smazán/)).toBeTruthy();
  });

  it('explains unticked permissions next to the connect button', () => {
    useAppStore.getState().setGcal({ notice: 'scopeMissing' });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    expect(screen.getByText(/nech políčka zaškrtnutá/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Zapnout synchronizaci/ })).toBeTruthy();
  });

  it('shows progress during a long first fill', () => {
    useAppStore
      .getState()
      .setGcal({ connected: true, syncing: true, progress: { done: 120, total: 480 } });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    expect(screen.getByText(/Synchronizuji 120\/480/)).toBeTruthy();
    // The first fill takes a while; say it doesn't need this sheet open.
    expect(screen.getByText(/můžeš zavřít/)).toBeTruthy();
  });
});
