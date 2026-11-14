import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, screen, cleanup } from '@testing-library/react';
import { DetailPanel } from '../../components/CampusMap/DetailPanel';
import { MapPanelBody } from '../../components/mobile/screens/map/MapPanelBody';
import { SPORT_PLACES } from '../../components/CampusMap/sportPlaces';
import { useAppStore } from '../../store/useAppStore';

/**
 * The Sportera places are a map feature on every product: the extension's
 * CampusMapView and the phone/iPad MapScreen each mount their own layers, and a
 * layer mounted in only one of them ships invisible on the other (society pins,
 * 2026-10-24). Same for the card: the desktop opens it in DetailPanel, the
 * phone's sheet and the iPad's rail through MapPanelBody.
 */
const MOUNTS = [
  'src/components/CampusMap/CampusMapView.tsx',
  'src/components/mobile/screens/MapScreen.tsx',
];
const SHELLS = [
  'src/components/mobile/screens/map/MapSheet.tsx',
  'src/components/mobile/screens/map/MapRail.tsx',
];
const place = SPORT_PLACES[0]!;

afterEach(cleanup);

describe('sport places on both trees', () => {
  it.each(MOUNTS)('%s mounts the pins and the Sport chip', (path) => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/<SportPlaceLayer\b/);
    expect(src).toMatch(/<SportChip\b/);
  });

  it.each(SHELLS)('%s hands a tapped place to the panel', (path) => {
    expect(readFileSync(path, 'utf8')).toMatch(/selectedSportPlace=\{selectedSportPlace\}/);
  });

  it('the desktop panel opens the card', () => {
    useAppStore.setState({ mapSelection: { kind: 'sportPlace', place } });
    render(<DetailPanel />);
    expect(screen.getByTestId('sport-place-card')).toBeTruthy();
  });

  it('the phone and iPad panel opens the card', () => {
    render(<MapPanelBody selectedEvent={null} selectedSportPlace={place} />);
    expect(screen.getByTestId('sport-place-card')).toBeTruthy();
  });

  it('the phone sheet treats it as a card, as it does a society pin', () => {
    expect(readFileSync('src/components/mobile/screens/map/useMapCardDetent.ts', 'utf8')).toMatch(
      /'sportPlace'/
    );
  });
});
