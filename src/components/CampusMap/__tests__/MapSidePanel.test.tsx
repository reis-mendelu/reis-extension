import { describe, it, expect, vi, beforeEach } from 'vitest';

// MapEventsSection (the default "events" tab body) pulls in useEventsFacultySettings,
// which does async IndexedDB + chrome.storage work via useEffect. Mocked here
// (as the pre-existing suite for this file did) so these tab-behavior tests
// stay synchronous and don't emit act() noise unrelated to what's under test.
vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu'], isLoading: false }),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MapSidePanel } from '../MapSidePanel';

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    mapPanelTab: 'events',
    // Shared store: without this, the collapse test below leaves it collapsed
    // for whatever runs next.
    mapPanelCollapsed: false,
    adminRole: null,
    adminAssociationId: null,
    adminActiveAssociationId: null,
    mapEvents: [],
    societyMapEvents: [],
    mapSelection: null,
    setMapPanelTab: vi.fn(),
  });
});

describe('MapSidePanel tabs', () => {
  it('shows two tabs for a normal student', () => {
    render(<MapSidePanel />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  // Authoring moved to AdminConsole, so the panel is student-only: a logged-in
  // society sees exactly what a student sees, with no third tab and no way to
  // reach authoring from the map.
  it('shows no extra tab for a logged-in association', () => {
    useAppStore.setState({
      adminRole: 'association',
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
    });
    render(<MapSidePanel />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.queryByRole('tab', { name: 'Moje akce' })).toBeNull();
  });

  it('switches between the two tabs', () => {
    const setMapPanelTab = vi.fn();
    useAppStore.setState({ setMapPanelTab });
    render(<MapSidePanel />);
    screen.getByRole('tab', { name: 'Místa' }).click();
    expect(setMapPanelTab).toHaveBeenCalledWith('places');
  });
});

/**
 * The panel collapses to its tab bar, the way the iPad sheet drops to peek.
 *
 * It floats over the map at w-72 and up to 80vh, which is a lot of campus to
 * cover while you are looking for a room. Two states, not the iPad's three:
 * the middle one earns its place on a sheet you drag, and this is a card with
 * a button.
 */
describe('MapSidePanel collapsing', () => {
  it('hides the tab body but keeps the tabs', () => {
    render(<MapSidePanel />);
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sbalit panel mapy' }));

    expect(screen.queryByRole('tabpanel')).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('comes back', () => {
    render(<MapSidePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Sbalit panel mapy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rozbalit panel mapy' }));
    expect(screen.getByRole('tabpanel')).toBeInTheDocument();
  });
});
