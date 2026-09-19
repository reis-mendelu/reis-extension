import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapPanelBody } from '../MapPanelBody';
import type { GardenPlace } from '../../../../../types/campusMap';

const PLACE: GardenPlace = {
  id: 'rokle',
  name: { cz: 'Rokle', en: 'The ravine' },
  lon: 16.6123,
  lat: 49.2141,
};

describe('MapPanelBody', () => {
  it('shows a garden place when one is selected', () => {
    render(<MapPanelBody selectedEvent={null} selectedGardenPlace={{ ...PLACE, photo: 'rokle-full.jpg' }} />);
    // The photograph IS the card, so the name lives in its alt text.
    expect(screen.getByAltText('Rokle')).toBeInTheDocument();
  });

  it('falls back to the events list when nothing is selected', () => {
    render(<MapPanelBody selectedEvent={null} selectedGardenPlace={null} />);
    expect(screen.queryByAltText('Rokle')).not.toBeInTheDocument();
  });
});
