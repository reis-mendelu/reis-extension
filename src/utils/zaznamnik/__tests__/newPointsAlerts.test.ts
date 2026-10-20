import { describe, it, expect } from 'vitest';
import { newPointsAlerts } from '../newPointsAlerts';

const subjects = {
  'EBC-PS': { nameCs: 'Počítačové sítě', nameEn: 'Computer Networks', subjectId: '164074' },
};

describe('newPointsAlerts', () => {
  it('one Novinky row per subject, naming what was added and how to open it', () => {
    const [a] = newPointsAlerts(
      { 'EBC-PS': [{ label: 'IPv4-subnt-NAOPAK', value: '9' }] },
      subjects as never,
      {},
      false
    );
    expect(a).toMatchObject({
      type: 'zaznamnik-points',
      title: 'Počítačové sítě',
      body: 'IPv4-subnt-NAOPAK: 9',
      courseCode: 'EBC-PS',
      courseId: '164074',
    });
  });

  it('more points later are a new row id, so the bell counts them again', () => {
    const one = newPointsAlerts({ X: [{ label: 'a', value: '1' }] }, {}, {}, false);
    const two = newPointsAlerts(
      {
        X: [
          { label: 'a', value: '1' },
          { label: 'b', value: '2' },
        ],
      },
      {},
      {},
      false
    );
    expect(one[0]!.id).not.toBe(two[0]!.id);
    expect(one[0]!.title).toBe('X');
  });

  it('uses the student’s nickname and the English name in English', () => {
    const [a] = newPointsAlerts(
      { 'EBC-PS': [{ label: 'a', value: '1' }] },
      subjects as never,
      { 'EBC-PS': 'Sítě' },
      true
    );
    expect(a!.title).toBe('Sítě');
    const [b] = newPointsAlerts(
      { 'EBC-PS': [{ label: 'a', value: '1' }] },
      subjects as never,
      {},
      true
    );
    expect(b!.title).toBe('Computer Networks');
  });
});
