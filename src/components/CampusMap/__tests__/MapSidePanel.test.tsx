import { describe, it, expect, vi, beforeEach } from 'vitest';

// MapEventsSection (the default "events" tab body) pulls in useEventsFacultySettings,
// which does async IndexedDB + chrome.storage work via useEffect. Mocked here
// (as the pre-existing suite for this file did) so these tab-behavior tests
// stay synchronous and don't emit act() noise unrelated to what's under test.
vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu'], isLoading: false }),
}));

import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MapSidePanel } from '../MapSidePanel';

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    mapPanelTab: 'events',
    adminRole: null,
    adminAssociationId: null,
    adminActiveAssociationId: null,
    mapEvents: [],
    societyMapEvents: [],
    eventFilter: 'all',
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
