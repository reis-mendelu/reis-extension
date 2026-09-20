import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GardenPlaceCard } from '../GardenPlaceCard';
import { useAppStore } from '../../../store/useAppStore';
import type { GardenPlace } from '../../../types/campusMap';

const PLACE: GardenPlace = {
  id: 'rokle',
  name: { cz: 'Rokle', en: 'The ravine' },
  lon: 16.6123,
  lat: 49.2141,
};

beforeEach(() => useAppStore.setState({ language: 'cz' }));

describe('GardenPlaceCard', () => {
  it('shows the photograph and nothing else — no caption, no hours', () => {
    const { container } = render(<GardenPlaceCard place={{ ...PLACE, photo: 'rokle-full.jpg' }} />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('img[src="/garden/rokle-full.jpg"]')).not.toBeNull();
  });

  it('paints the bundled thumb under it, so the card is never empty', () => {
    const { container } = render(<GardenPlaceCard place={{ ...PLACE, photo: 'rokle-full.jpg' }} />);
    expect(container.querySelector('img[src="/garden/rokle.jpg"]')).not.toBeNull();
  });

  it('names the place for a screen reader, since nothing is written on screen', () => {
    render(<GardenPlaceCard place={{ ...PLACE, photo: 'rokle-full.jpg' }} />);
    expect(screen.getByAltText('Rokle')).toBeInTheDocument();
  });

  it('fetches nothing — both files are bundled', () => {
    const { container } = render(<GardenPlaceCard place={{ ...PLACE, photo: 'rokle-full.jpg' }} />);
    expect(container.querySelector('img[src^="http"]')).toBeNull();
  });

  it('renders an attribution only when the photo came from someone else', () => {
    const { container } = render(
      <GardenPlaceCard
        place={{ ...PLACE, photo: 'rokle-full.jpg', credit: 'Jan Novák, CC BY-SA 4.0' }}
      />
    );
    expect(container.textContent).toContain('Jan Novák');
  });

  it('shows nothing at all for a place with no photograph', () => {
    const { container } = render(<GardenPlaceCard place={PLACE} />);
    expect(container.innerHTML).toBe('');
  });

  it('maximizes the photo when it is pressed, and closes again', () => {
    render(<GardenPlaceCard place={{ ...PLACE, photo: 'rokle-full.jpg' }} />);
    // Two images of the same place once open: the card's and the full-screen one.
    expect(screen.getAllByAltText('Rokle')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Rokle' }));
    expect(screen.getAllByAltText('Rokle')).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button')[1]!);
    expect(screen.getAllByAltText('Rokle')).toHaveLength(1);
  });

  it('closes the maximized photo on Escape', () => {
    render(<GardenPlaceCard place={{ ...PLACE, photo: 'rokle-full.jpg' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rokle' }));
    expect(screen.getAllByAltText('Rokle')).toHaveLength(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getAllByAltText('Rokle')).toHaveLength(1);
  });

  it('shows the new thumb when the selection moves to another place', () => {
    const a = { ...PLACE, photo: 'rokle-full.jpg' };
    const b = {
      ...PLACE,
      id: 'jezirka',
      name: { cz: 'Jezírka', en: 'The ponds' },
      photo: 'jezirka-full.jpg',
    };
    const { container, rerender } = render(<GardenPlaceCard place={a} />);
    // the first photo finishes loading, so its thumb fades out
    fireEvent.load(screen.getByAltText('Rokle'));
    expect(container.querySelector('img[src="/garden/rokle.jpg"]')!.className).toContain(
      'opacity-0'
    );
    // moving to another place must NOT inherit that
    rerender(<GardenPlaceCard place={b} />);
    expect(container.querySelector('img[src="/garden/jezirka.jpg"]')!.className).toContain(
      'opacity-100'
    );
  });
});
