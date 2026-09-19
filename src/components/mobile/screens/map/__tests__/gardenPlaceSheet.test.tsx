import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapPanelBody } from '../MapPanelBody';
import type { GardenPlace } from '../../../../../types/campusMap';

const PLACE: GardenPlace = {
  id: 'rokle',
  number: '2.6',
  section: 2,
  name: { cz: 'Rokle', en: 'The ravine' },
  why: { cz: 'Zarostlý zářez pod jižními svahy.', en: 'An overgrown cut below the slopes.' },
  lon: 16.6123,
  lat: 49.2141,
};

describe('MapPanelBody', () => {
  it('shows a garden place when one is selected', () => {
    render(<MapPanelBody selectedEvent={null} selectedGardenPlace={PLACE} />);
    expect(screen.getByText('Rokle')).toBeInTheDocument();
    expect(screen.getByText(/7:00–15:00/)).toBeInTheDocument();
  });

  it('falls back to the events list when nothing is selected', () => {
    render(<MapPanelBody selectedEvent={null} selectedGardenPlace={null} />);
    expect(screen.queryByText('Rokle')).not.toBeInTheDocument();
  });
});
