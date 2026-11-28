import { describe, it, expect } from 'vitest';
import { isProjectDataAudience, projectDataUrl } from '../projectData';

describe('projectDataUrl', () => {
  it('is the Czech page for Czech and the English page for any other language', () => {
    expect(projectDataUrl('cz')).toBe('https://reisapp.cz/navody/data-pro-projekty');
    expect(projectDataUrl('en')).toBe('https://reisapp.cz/en/guides/project-data');
  });
});

describe('isProjectDataAudience', () => {
  it('matches informatics students on PEF only', () => {
    expect(isProjectDataAudience({ facultyKey: 'pef', programme: 'B-OI' })).toBe(true);
    expect(isProjectDataAudience({ facultyKey: 'pef', programme: 'N-OI' })).toBe(true);
    expect(isProjectDataAudience({ facultyKey: 'pef', programme: 'B-EM' })).toBe(false);
    expect(isProjectDataAudience({ facultyKey: 'af', programme: 'B-OI' })).toBe(false);
    expect(isProjectDataAudience({ facultyKey: 'pef', programme: null })).toBe(false);
    expect(isProjectDataAudience({ facultyKey: null, programme: 'B-OI' })).toBe(false);
  });
});
