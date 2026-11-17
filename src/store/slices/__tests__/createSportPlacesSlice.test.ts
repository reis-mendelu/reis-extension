import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
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

describe('sport places on the map', () => {
  beforeEach(() => useAppStore.setState({ mapSelection: null }));

  it('a tapped place becomes the map selection', () => {
    useAppStore.getState().selectSportPlace(court);
    expect(useAppStore.getState().mapSelection).toEqual({ kind: 'sportPlace', place: court });
  });
});
