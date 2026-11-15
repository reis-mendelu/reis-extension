import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SportPlaceCard } from '../SportPlaceCard';
import { useAppStore } from '../../../store/useAppStore';
import type { SportPlace } from '../../../types/campusMap';

const court: SportPlace = {
  id: 'basketbal-schreberovy-zahradky',
  sport: 'basketball',
  name: 'Basketbal Schreberovy zahrádky',
  coord: [16.62111, 49.20788],
  url: 'https://sportera.cz/place/basketbal/bfs-basketbal-schreberovy-zahradky',
  hours: 'nonstop',
  surface: 'tartan',
  count: 2,
  near: { building: 'E', metres: 370 },
};

afterEach(cleanup);

describe('SportPlaceCard', () => {
  it('in Czech: the name, how far, the chips and the place on Sportera', () => {
    useAppStore.setState({ language: 'cz' } as never);
    render(<SportPlaceCard place={court} />);
    expect(screen.getByText('Basketbal Schreberovy zahrádky')).toBeTruthy();
    expect(screen.getByText('370 m od budovy E')).toBeTruthy();
    expect(screen.getByText('Nonstop')).toBeTruthy();
    expect(screen.getByText('Tartan')).toBeTruthy();
    expect(screen.getByText('2 koše')).toBeTruthy();
    const link = screen.getByRole('link', { name: /Otevřít na Sporteře/ });
    expect(link.getAttribute('href')).toBe(
      'https://sportera.cz/place/basketbal/bfs-basketbal-schreberovy-zahradky'
    );
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('in English', () => {
    useAppStore.setState({ language: 'en' } as never);
    render(<SportPlaceCard place={court} />);
    expect(screen.getByText('370 m from building E')).toBeTruthy();
    expect(screen.getByText('Open 24/7')).toBeTruthy();
    expect(screen.getByText('2 hoops')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open on Sportera/ })).toBeTruthy();
  });

  it('shows hours as given, and one table in the singular', () => {
    useAppStore.setState({ language: 'cz' } as never);
    render(
      <SportPlaceCard
        place={{ ...court, sport: 'pingpong', hours: '8:00–21:00', surface: 'gravel', count: 1 }}
      />
    );
    expect(screen.getByText('8:00–21:00')).toBeTruthy();
    expect(screen.getByText('Kačírek')).toBeTruthy();
    expect(screen.getByText('1 stůl')).toBeTruthy();
  });

  it('has no chip row when nobody has said the hours, surface or count', () => {
    useAppStore.setState({ language: 'cz' } as never);
    render(
      <SportPlaceCard
        place={{ ...court, sport: 'workout', hours: null, surface: null, count: null }}
      />
    );
    expect(screen.queryByTestId('sport-place-chips')).toBeNull();
    expect(screen.getByRole('link', { name: /Otevřít na Sporteře/ })).toBeTruthy();
  });
});
