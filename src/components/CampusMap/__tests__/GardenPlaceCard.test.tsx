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

  it('shows the bundled thumb even with no full photo chosen yet', () => {
    const { container } = render(<GardenPlaceCard place={PLACE} />);
    expect(container.querySelector('img[src="/garden/rokle.webp"]')).not.toBeNull();
    // and nothing is reaching for a photo that was never chosen
    expect(container.querySelector('img[src^="https://"]')).toBeNull();
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
