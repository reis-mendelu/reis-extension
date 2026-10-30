import { describe, it, expect } from 'vitest';
import { schoolStatsText } from '../schoolStatsText';
import type { SchoolStats } from '../../../api/schoolStats';

const STATS: SchoolStats = {
  weekFrom: '2026-10-19',
  weekTo: '2026-10-25',
  regulars: 1990,
  regularsPhone: 1786,
  regularsByFaculty: [
    { key: 'PEF', devices: 1325 },
    { key: 'AF', devices: 247 },
    { key: 'ZF', devices: -1 },
  ],
  eduroamSince: '2026-09-23',
  eduroamWifi: 455,
  eduroamProfile: 93,
  eduroamByFaculty: [{ key: 'PEF', devices: 236 }],
  eduroamByWeek: [],
  events: { posts: 63, views: 11216, clicks: 850, mapViews: 609 },
  notices: [
    {
      id: 'q1',
      prompt: 'reIS je teď na Google Play',
      startsAt: '2026-10-24T21:43:08+00:00',
      endsAt: '2026-11-07T21:43:08+00:00',
      seen: 711,
    },
    {
      id: 'q2',
      prompt: 'Malá otázka',
      startsAt: '2026-10-20T08:00:00+00:00',
      endsAt: '2026-10-21T08:00:00+00:00',
      seen: -1,
    },
  ],
};

// Czech digit grouping uses a no-break space; compare with plain spaces.
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

describe('schoolStatsText', () => {
  const text = plain(schoolStatsText(STATS));

  it('opens with the week it describes', () => {
    expect(text.split('\n')[0]).toBe('reIS v číslech, týden 19. 10. – 25. 10. 2026');
  });

  it('gives the regulars, the phone share and the faculties', () => {
    expect(text).toContain(
      'Pravidelní uživatelé (2+ dny v týdnu): 1 990, z toho na telefonu 1 786'
    );
    expect(text).toContain('PEF 1 325 · AF 247 · ZF méně než 10');
  });

  it('gives eduroam since the counter began, and how it works', () => {
    expect(text).toContain(
      'eduroam nastavený přes reIS od 23. 9. 2026: 455 telefonů, 93 notebooků'
    );
    expect(text).toContain('certifikát vydává UIS');
  });

  it('gives event reach and every notice, hidden ones as under 10', () => {
    expect(text).toContain('63 příspěvků, 11 216 zobrazení, 850 prokliků, 609 otevření na mapě');
    expect(text).toContain('„reIS je teď na Google Play“: 711 zařízení');
    expect(text).toContain('„Malá otázka“: méně než 10 zařízení');
  });

  it('says what is counted', () => {
    expect(text).toContain('Počty zařízení, ne lidí. Skupiny pod 10 jsou skryté.');
  });
});
