import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GardenPlaceCard } from '../GardenPlaceCard';
import { useAppStore } from '../../../store/useAppStore';
import type { GardenPlace } from '../../../types/campusMap';

const PLACE: GardenPlace = {
  id: 'rokle',
  number: '2.6',
  section: 2,
  name: { cz: 'Rokle', en: 'The ravine' },
  why: { cz: 'Zarostlý zářez pod jižními svahy.', en: 'An overgrown cut below the slopes.' },
  lon: 16.6123,
  lat: 49.2141,
};

beforeEach(() => useAppStore.setState({ language: 'cz' }));

describe('GardenPlaceCard', () => {
  it('names the place, its section and why you would go', () => {
    render(<GardenPlaceCard place={PLACE} />);
    expect(screen.getByText('Rokle')).toBeInTheDocument();
    expect(screen.getByText(/Jižní svahy/)).toBeInTheDocument();
    expect(screen.getByText('2.6')).toBeInTheDocument();
    expect(screen.getByText(PLACE.why.cz)).toBeInTheDocument();
  });

  it('always says when the garden is open and that students get in free', () => {
    render(<GardenPlaceCard place={PLACE} />);
    expect(screen.getByText(/7:00–15:00/)).toBeInTheDocument();
    expect(screen.getByText(/zdarma/)).toBeInTheDocument();
  });

  it('shows no photo block at all until a photograph is chosen', () => {
    const { container } = render(<GardenPlaceCard place={PLACE} />);
    // An empty framed box is the grey rectangle this card exists to avoid.
    expect(container.querySelector('img')).toBeNull();
  });

  it('paints the bundled thumb under the full photo, so the card is never empty', () => {
    const { container } = render(<GardenPlaceCard place={{ ...PLACE, photo: 'rokle.8f3a1c.webp' }} />);
    expect(container.querySelector('img[src="/garden/rokle.webp"]')).not.toBeNull();
  });

  it('loads the full photo from the CDN when one is recorded', () => {
    render(
      <GardenPlaceCard
        place={{ ...PLACE, photo: 'rokle.8f3a1c.webp', credit: 'Jan Novák, CC BY-SA 4.0' }}
      />
    );
    expect(screen.getByAltText('Rokle')).toHaveAttribute(
      'src',
      'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/garden/rokle.8f3a1c.webp'
    );
    expect(screen.getByText(/Jan Novák/)).toBeInTheDocument();
  });

  it('follows the app language', () => {
    useAppStore.setState({ language: 'en' });
    render(<GardenPlaceCard place={PLACE} />);
    expect(screen.getByText('The ravine')).toBeInTheDocument();
    expect(screen.getByText(PLACE.why.en)).toBeInTheDocument();
  });
});
