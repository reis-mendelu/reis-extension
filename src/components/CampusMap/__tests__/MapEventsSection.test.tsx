import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu', 'pef'], isLoading: false }),
}));
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapEventsSection } from '../MapEventsSection';
import { useAppStore } from '../../../store/useAppStore';
import { MOCK_MAP_EVENTS } from './fixtures/mockMapEvents';

beforeEach(() => {
  useAppStore.setState({
    mapEvents: MOCK_MAP_EVENTS,
    eventFilter: 'all',
    mapSelection: null,
    language: 'en',
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

  it('selecting a society chip filters the list to that society', async () => {
    render(<MapEventsSection />);
    // SUPEF chip → only SU PEF events (PEF Kvíz); other societies drop out.
    await userEvent.click(screen.getByRole('button', { name: 'SUPEF' }));
    expect(useAppStore.getState().eventFilter).toBe('supef');
    expect(screen.getByText('PEF Kvíz')).toBeTruthy();
    expect(screen.queryByText('Karaoke Night')).toBeNull();
  });

  it('my-faculty spolek chip (SUPEF) is ordered before the others', () => {
    render(<MapEventsSection />);
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    // subscribed faculties = mendelu + pef (mocked) → SUPEF leads the societies.
    expect(names.indexOf('SUPEF')).toBeLessThan(names.indexOf('ESN'));
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
});
