import { describe, it, expect } from 'vitest';
import { isProjectDataAudience, projectDataUrl } from '../projectData';

describe('projectDataUrl', () => {
  it('sends EBC-VWA to the web section and EBC-PJ to the Java section', () => {
    expect(projectDataUrl('EBC-VWA', 'cz')).toBe('https://reisapp.cz/navody/data-pro-projekty#web');
    expect(projectDataUrl('EBC-PJ', 'cz')).toBe('https://reisapp.cz/navody/data-pro-projekty#java');
  });

  it('gives the English page for any language that is not Czech', () => {
    expect(projectDataUrl('EBC-VWA', 'en')).toBe('https://reisapp.cz/en/guides/project-data#web');
    expect(projectDataUrl('EBC-PJ', 'en')).toBe('https://reisapp.cz/en/guides/project-data#java');
  });

  it('is null for an unlisted subject and for a box with no course code', () => {
    expect(projectDataUrl('EBC-M', 'cz')).toBeNull();
    expect(projectDataUrl(undefined, 'cz')).toBeNull();
    expect(projectDataUrl('', 'cz')).toBeNull();
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
