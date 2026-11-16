import { describe, expect, it } from 'vitest';
import { guidesIndexUrl } from '../guideUrl';

/** The live reisapp.cz guide index, written out by hand. */
describe('guidesIndexUrl', () => {
  it('opens the Czech index', () => {
    expect(guidesIndexUrl('cz')).toBe('https://reisapp.cz/navody?z=app');
  });

  it('opens the English index', () => {
    expect(guidesIndexUrl('en')).toBe('https://reisapp.cz/en/guides?z=app');
  });

  it('treats anything that is not Czech as English', () => {
    expect(guidesIndexUrl('cs')).toBe('https://reisapp.cz/en/guides?z=app');
  });
});
