import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu', 'pef'], isLoading: false }),
}));
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapSidePanel } from '../MapSidePanel';
import { useAppStore } from '../../../store/useAppStore';
import { MOCK_MAP_EVENTS } from '../../../api/mapEvents';

beforeEach(() => {
  useAppStore.setState({ mapPanelTab: 'places', mapEvents: MOCK_MAP_EVENTS, eventFilter: 'all', mapSelection: null, language: 'en' });
});

describe('MapSidePanel', () => {
  it('defaults to the Places tab', () => {
    render(<MapSidePanel />);
    // Main campus row from LandmarkPicker is present in Places.
    expect(screen.getByText('Main campus')).toBeTruthy();
  });

  it('switches to the Events tab and shows society events', async () => {
    render(<MapSidePanel />);
    await userEvent.click(screen.getByRole('tab', { name: /Events/ }));
    expect(useAppStore.getState().mapPanelTab).toBe('events');
    expect(screen.getByText('PEF Kvíz')).toBeTruthy();
  });
});
