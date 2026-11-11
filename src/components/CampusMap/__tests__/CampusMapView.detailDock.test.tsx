import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CampusMapView } from '../CampusMapView';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../MapCanvas', () => ({ MapCanvas: () => null }));
vi.mock('../EventLayer', () => ({ EventLayer: () => null }));
vi.mock('../SocietyPinLayer', () => ({ SocietyPinLayer: () => null }));
vi.mock('../MapSidePanel', () => ({ MapSidePanel: () => null }));
vi.mock('../RoomSearch', () => ({ RoomSearch: () => null }));
vi.mock('../FloorStack', () => ({ FloorStack: () => null }));
vi.mock('../OsmTileAccessBanner', () => ({ OsmTileAccessBanner: () => null }));
vi.mock('../DetailPanel', () => ({ DetailPanel: () => <div data-testid="detail-panel" /> }));
vi.mock('../../../hooks/useMapDwell', () => ({ useMapDwell: () => {} }));

/**
 * The extension's map docks the selected place's card at the bottom left. A
 * venue card (S-klub: photos, lunch, a whole menu) is taller than the map, and
 * with nothing bounding the dock its top — name, open status, "Trasa sem" —
 * sat above the map where nothing could scroll to it (release check, 11
 * November 2026: 1212px of card in a 713px map). The dock is bounded by the
 * map and scrolls.
 */
describe('CampusMapView — detail dock', () => {
  it('bounds the card by the map and lets it scroll', () => {
    useAppStore.setState({ mapSelection: { kind: 'poi' }, placingEvent: null } as never);
    render(<CampusMapView />);
    const dock = screen.getByTestId('detail-panel').parentElement!;
    expect(dock.className).toMatch(/\bmax-h-\[calc\(100%-/);
    expect(dock.className).toMatch(/\boverflow-y-auto\b/);
  });
});
