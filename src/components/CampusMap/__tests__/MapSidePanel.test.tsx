import { describe, it, expect, vi, beforeEach } from 'vitest';

// EventsList (the default "events" tab body) pulls in useEventsFacultySettings,
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
    language: 'cz', mapMode: 'student', mapPanelTab: 'events', adminRole: null, adminAssociationId: null,
    mapEvents: [], societyMapEvents: [], eventFilter: 'all', mapSelection: null,
    setMapMode: vi.fn(), setMapPanelTab: vi.fn(),
  });
});

describe('MapSidePanel tabs', () => {
  it('shows two tabs for a normal student', () => {
    render(<MapSidePanel />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('shows the third "Moje akce" tab for an association', () => {
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef' });
    render(<MapSidePanel />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });

  it('clicking the society tab enters society mode', () => {
    const setMapMode = vi.fn();
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef', setMapMode });
    render(<MapSidePanel />);
    // "Moje akce" — exact accessible name avoids ambiguity with the "Akce" tab.
    screen.getByRole('tab', { name: 'Moje akce' }).click();
    expect(setMapMode).toHaveBeenCalledWith('society');
  });

  it('clicking Events from society mode returns to student mode', () => {
    const setMapMode = vi.fn();
    useAppStore.setState({ adminRole: 'association', adminAssociationId: 'supef', mapMode: 'society', setMapMode });
    render(<MapSidePanel />);
    // Exact "Akce" (not a substring match) so it doesn't also match "Moje akce".
    screen.getByRole('tab', { name: 'Akce' }).click();
    expect(setMapMode).toHaveBeenCalledWith('student');
  });
});
