import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { connect, disconnect } = vi.hoisted(() => ({
  connect: vi.fn(async () => {}),
  disconnect: vi.fn(async (_o: { deleteCalendar: boolean }) => {}),
}));
vi.mock('../../../../mobile/googleCalendar/controller', () => ({
  connectGoogleCalendar: () => connect(),
  disconnectGoogleCalendar: (o: { deleteCalendar: boolean }) => disconnect(o),
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

  it('shows the account and turns off without deleting', () => {
    useAppStore
      .getState()
      .setGcal({ connected: true, email: 'reis.mendelu@gmail.com', lastSyncAt: Date.now() });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    expect(screen.getByText('Účet: reis.mendelu@gmail.com')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Jen vypnout/ }));
    expect(disconnect).toHaveBeenCalledWith({ deleteCalendar: false });
  });

  it('deletes the calendar only after a second, explicit tap', () => {
    useAppStore.getState().setGcal({ connected: true, email: 'x@y', lastSyncAt: Date.now() });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Vypnout a smazat kalendář Rozvrh/ }));
    expect(disconnect).not.toHaveBeenCalled();
    expect(screen.getByText(/nejde vrátit/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Smazat Rozvrh/ }));
    expect(disconnect).toHaveBeenCalledWith({ deleteCalendar: true });
  });

  it('can back out of deleting', () => {
    useAppStore.getState().setGcal({ connected: true, email: 'x@y', lastSyncAt: Date.now() });
    render(<GoogleCalendarSheet onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Vypnout a smazat kalendář Rozvrh/ }));
    fireEvent.click(screen.getByRole('button', { name: /Zpět/ }));
    expect(screen.getByRole('button', { name: /Vypnout a smazat kalendář Rozvrh/ })).toBeTruthy();
    expect(disconnect).not.toHaveBeenCalled();
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
