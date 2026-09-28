import { describe, it, expect, beforeEach } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapEventsSection } from '../MapEventsSection';
import { useAppStore } from '../../../store/useAppStore';
import { MOCK_MAP_EVENTS } from './fixtures/mockMapEvents';
import type { MapEvent } from '../../../types/events';
import { localTodayIso } from '../eventWindow';

// Days-from-today ISO date, for tests that need to land in a specific
// weekSections bucket relative to the real clock (the component calls
// weekSections(events) with no injected `now`).
function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  // Local calendar day, as weekSections reads it — not toISOString(), which is UTC.
  return localTodayIso(d);
}

beforeEach(() => {
  useAppStore.setState({
    mapEvents: MOCK_MAP_EVENTS,
    mapSelection: null,
    language: 'en',
    mapLaterExpanded: false,
  });
});

describe('MapEventsSection', () => {
  it('renders the upcoming events', () => {
    render(<MapEventsSection />);
    expect(screen.getByText('PEF Kvíz')).toBeTruthy();
    expect(screen.getByText('Karaoke Night')).toBeTruthy();
  });

  it('clicking a row selects the event in the store', async () => {
    render(<MapEventsSection />);
    await userEvent.click(screen.getByText('PEF Kvíz'));
    expect(useAppStore.getState().mapSelection?.kind).toBe('event');
  });

  it('shows an empty state when there are no events', () => {
    useAppStore.setState({ mapEvents: [] });
    render(<MapEventsSection />);
    expect(screen.getByText('No events')).toBeTruthy();
  });

  it('renders a category emoji thumbnail on rows without a poster', () => {
    const { container } = render(<MapEventsSection />);
    // No mock event has a poster → each row shows its category emoji tile.
    // PEF Kvíz → quiz → 🧠 (1f9e0).
    expect(container.querySelector('img[src="/emoji/1f9e0.svg"]')).toBeTruthy();
  });

  it('collapses the Later bucket by default and expands it on click', async () => {
    const base = MOCK_MAP_EVENTS[0]!;
    const soon: MapEvent = { ...base, id: 'soon', title: 'Soon Event', date: isoDaysFromNow(3) };
    const later1: MapEvent = {
      ...base,
      id: 'later-1',
      title: 'Later Event One',
      date: isoDaysFromNow(30),
    };
    const later2: MapEvent = {
      ...base,
      id: 'later-2',
      title: 'Later Event Two',
      date: isoDaysFromNow(30),
    };
    useAppStore.setState({ mapEvents: [soon, later1, later2] });

    render(<MapEventsSection />);

    const laterButton = screen.getByRole('button', { name: 'Later (2)' });
    expect(laterButton).toBeTruthy();
    expect(screen.queryByText('Later Event One')).toBeNull();
    expect(screen.queryByText('Later Event Two')).toBeNull();

    await userEvent.click(laterButton);

    expect(screen.getByText('Later Event One')).toBeTruthy();
    expect(screen.getByText('Later Event Two')).toBeTruthy();
  });

  // A Novinky or calendar tap can select an event months out. Its pin and card
  // show, so its row must too — and the header must still toggle afterwards.
  it('opens Later when a far event is selected, and the header still collapses it', async () => {
    const base = MOCK_MAP_EVENTS[0]!;
    const far: MapEvent = { ...base, id: 'far', title: 'Far Event', date: isoDaysFromNow(40) };
    useAppStore.setState({ mapEvents: [far] });
    useAppStore.getState().focusEventById('far', { fly: true });
    render(<MapEventsSection />);

    const header = screen.getByRole('button', { name: 'Later (1)' });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Far Event')).toBeTruthy();

    await userEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Far Event')).toBeNull();
  });

  it('leaves Later as it was when a near event is selected', () => {
    const base = MOCK_MAP_EVENTS[0]!;
    const near: MapEvent = { ...base, id: 'near', date: isoDaysFromNow(3) };
    useAppStore.setState({ mapEvents: [near] });
    useAppStore.getState().focusEventById('near', { fly: true });
    expect(useAppStore.getState().mapLaterExpanded).toBe(false);
  });
});
