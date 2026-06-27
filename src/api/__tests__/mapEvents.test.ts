import { describe, it, expect } from 'vitest';
import { MOCK_MAP_EVENTS } from '../mapEvents';

describe('MOCK_MAP_EVENTS categories', () => {
  it('gives every event a category', () => {
    for (const e of MOCK_MAP_EVENTS) expect(e.category).toBeTruthy();
  });

  it('categorises known titles correctly', () => {
    const byTitle = (t: string) => MOCK_MAP_EVENTS.find((e) => e.title === t);
    expect(byTitle('Deskovky')?.category).toBe('boardgames');
    expect(byTitle('Trip to Ostrava')?.category).toBe('trip');
    expect(byTitle('Tram Party')?.category).toBe('party');
    expect(byTitle('PEF Kvíz')?.category).toBe('quiz');
  });
});
