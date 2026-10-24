import { describe, it, expect } from 'vitest';
import { newPointsNotification } from '../newPointsText';

const names: Record<string, string> = {
  'EBC-PS': 'Počítačové sítě',
  'EBC-VWA': 'Vývoj webových aplikací',
};
const nameOf = (code: string) => names[code] ?? code;

describe('newPointsNotification', () => {
  it('one subject: names it and lists what was added', () => {
    expect(
      newPointsNotification(
        { 'EBC-PS': [{ label: 'IPv4-subnt-NAOPAK', value: '9' }] },
        nameOf,
        'cz'
      )
    ).toEqual({ title: 'Nové body: Počítačové sítě', body: 'IPv4-subnt-NAOPAK: 9' });
  });

  it('one subject, many entries: the first three, then an ellipsis', () => {
    const points = ['1', '2', '3', '4'].map((label) => ({ label, value: '1' }));
    expect(newPointsNotification({ 'EBC-VWA': points }, nameOf, 'en')).toEqual({
      title: 'New points: Vývoj webových aplikací',
      body: '1: 1, 2: 1, 3: 1, …',
    });
  });

  it('several subjects: one summary naming them', () => {
    expect(
      newPointsNotification(
        {
          'EBC-PS': [{ label: 'IPv4-subnt', value: '4' }],
          'EBC-VWA': [{ label: '2', value: '1' }],
        },
        nameOf,
        'cz'
      )
    ).toEqual({
      title: 'Nové body v záznamníku',
      body: 'Počítačové sítě, Vývoj webových aplikací',
    });
  });
});
