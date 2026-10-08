import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapEventsSection } from '../MapEventsSection';
import { useAppStore } from '../../../store/useAppStore';
import { neutralSociety } from '../../../utils/societies/resolveSociety';
import { localTodayIso } from '../eventWindow';
import { MOCK_MAP_EVENTS } from './fixtures/mockMapEvents';
import type { MapEvent } from '../../../types/events';
import { trackMapEventView } from '../../../api/featureUsage';

vi.mock('../../../api/featureUsage', () => ({ trackMapEventView: vi.fn() }));

// An event imported from a semester list has a title and a date and nothing
// else, so its card repeated the row around one button. The row IS that button.
const bare: MapEvent = {
  ...MOCK_MAP_EVENTS[0]!,
  id: 'bare',
  title: 'Boat Party',
  url: '',
  date: localTodayIso(),
  time: null,
  location: null,
  coord: null,
  roomCode: null,
  venueKind: 'tba',
  description: null,
};
const detailed: MapEvent = { ...MOCK_MAP_EVENTS[0]!, id: 'detailed', date: localTodayIso() };

beforeEach(() => {
  vi.mocked(trackMapEventView).mockClear();
  useAppStore.setState({
    mapEvents: [bare, detailed],
    mapSelection: null,
    language: 'en',
    societies: { esn: { ...neutralSociety('esn'), instagram: 'esnmendelubrno' } },
  });
});

describe('MapEventsSection rows with nothing to expand', () => {
  it('link straight to the society and say they leave the app', () => {
    render(<MapEventsSection />);
    const row = screen.getByRole('link', { name: /Boat Party/ });
    expect(row.getAttribute('href')).toBe('https://www.instagram.com/esnmendelubrno/');
    expect(row.getAttribute('target')).toBe('_blank');
    expect(row.querySelector('[data-testid="event-row-external"]')).toBeTruthy();
  });

  it('do not open a card behind the link', async () => {
    render(<MapEventsSection />);
    const row = screen.getByRole('link', { name: /Boat Party/ });
    row.addEventListener('click', (e) => e.preventDefault()); // jsdom has no new tab
    await userEvent.click(row);
    expect(useAppStore.getState().mapSelection).toBeNull();
    // Nothing opened on the map, so it is not a map view.
    expect(trackMapEventView).not.toHaveBeenCalled();
  });

  it('a row with details still opens its card', async () => {
    render(<MapEventsSection />);
    expect(screen.queryByRole('link', { name: new RegExp(detailed.title) })).toBeNull();
    await userEvent.click(screen.getByText(detailed.title));
    expect(useAppStore.getState().mapSelection).toMatchObject({ event: { id: 'detailed' } });
    expect(trackMapEventView).toHaveBeenCalledWith('detailed');
  });

  it('a bare row with nowhere to go keeps its card', async () => {
    useAppStore.setState({ societies: { esn: neutralSociety('esn') } });
    render(<MapEventsSection />);
    expect(screen.queryByRole('link', { name: /Boat Party/ })).toBeNull();
    await userEvent.click(screen.getByText('Boat Party'));
    expect(useAppStore.getState().mapSelection).toMatchObject({ event: { id: 'bare' } });
  });
});
