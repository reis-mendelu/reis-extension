import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// On Capacitor, the app-wide capture handler (installExternalLinkHandler)
// already routes a target=_blank tap through openExternal. The card used to
// open the same link a second time from its own onClick.
vi.mock('../../../platform', async (orig) => ({
  ...(await orig<typeof import('../../../platform')>()),
  getPlatform: () => ({ kind: 'capacitor' }),
}));
vi.mock('../../../mobile/openExternal', async (orig) => ({
  ...(await orig<typeof import('../../../mobile/openExternal')>()),
  openExternal: vi.fn(async () => {}),
}));

vi.mock('../../../mobile/openVenue', () => ({ openVenue: vi.fn() }));
vi.mock('../../../utils/reportError', async (orig) => ({
  ...(await orig<typeof import('../../../utils/reportError')>()),
  logError: vi.fn(),
}));

import { openExternal } from '../../../mobile/openExternal';
import { openVenue } from '../../../mobile/openVenue';
import { logError } from '../../../utils/reportError';
import { waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventDetailCard } from '../EventDetailCard';
import type { MapEvent } from '../../../types/events';

const ev: MapEvent = {
  id: 'e1',
  title: 'Kvíz',
  url: 'https://example.com/event',
  date: '2026-11-23',
  endDate: null,
  time: null,
  location: null,
  imageUrl: null,
  organizerKey: 'pef',
  societyId: 'supef',
  coord: null,
  roomCode: null,
  venueKind: 'tba',
  category: 'quiz',
};

beforeEach(() => {
  vi.mocked(openExternal).mockReset();
  vi.mocked(openExternal).mockResolvedValue(undefined);
  vi.mocked(logError).mockClear();
  useAppStore.setState({ language: 'en' });
});

describe('EventDetailCard details link on Capacitor', () => {
  it('leaves the tap to the app-wide link handler instead of opening it itself', () => {
    render(<EventDetailCard event={ev} />);
    const link = screen.getByRole('link', { name: /more info/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).not.toHaveAttribute('data-native-open');
    fireEvent.click(link);
    expect(openExternal).not.toHaveBeenCalled();
  });
});

describe('EventVenueLine on Capacitor', () => {
  // The native open failed and so did the web fallback (demo mode rejects
  // every openExternal): both are logged, neither is an unhandled rejection.
  it('logs a failed web fallback instead of leaving it unhandled', async () => {
    vi.mocked(openVenue).mockRejectedValue(new Error('no @capacitor/core'));
    vi.mocked(openExternal).mockRejectedValue(new Error('demo'));
    render(<EventDetailCard event={{ ...ev, venueKind: 'offcampus', coord: [16.6, 49.2] }} />);
    fireEvent.click(screen.getByRole('link', { name: /open in maps/i }));
    await waitFor(() =>
      expect(logError).toHaveBeenCalledWith('EventVenueLine.openExternal', expect.any(Error))
    );
    expect(logError).toHaveBeenCalledWith('EventVenueLine.openVenue', expect.any(Error));
  });
});
