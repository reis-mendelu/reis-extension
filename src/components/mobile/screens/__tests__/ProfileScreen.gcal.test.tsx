import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

const GCAL = {
  available: false,
  connected: false,
  email: null,
  syncing: false,
  progress: null,
  lastSyncAt: null,
  notice: null,
} as const;

describe('ProfileScreen — Google Calendar row', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz', mobileSheets: [] } as never);
    useAppStore.getState().setGcal(GCAL);
  });

  it('is absent where the native half says Google sign-in is unavailable', () => {
    render(<ProfileScreen />);
    expect(screen.queryByText('Google Kalendář')).not.toBeInTheDocument();
  });

  it('says what it syncs while off, and opens its sheet', () => {
    useAppStore.getState().setGcal({ available: true });
    render(<ProfileScreen />);
    expect(screen.getByText('Rozvrh, zkoušky a vlastní události')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Google Kalendář'));
    expect(useAppStore.getState().mobileSheets.at(-1)).toEqual({ kind: 'googleCalendar' });
  });

  it('shows the last sync time while on', () => {
    useAppStore.getState().setGcal({
      available: true,
      connected: true,
      lastSyncAt: new Date('2026-10-08T14:02:00').getTime(),
    });
    render(<ProfileScreen />);
    expect(screen.getByText('Synchronizováno 14:02')).toBeInTheDocument();
  });

  it("shows the first fill's progress, so closing the sheet still shows it running", () => {
    useAppStore.getState().setGcal({
      available: true,
      connected: true,
      syncing: true,
      progress: { done: 56, total: 136 },
    });
    render(<ProfileScreen />);
    expect(screen.getByText('Synchronizuji 56/136')).toBeInTheDocument();
  });
});
