import { describe, expect, it } from 'vitest';
import { toDesired } from '../toGoogleEvent';
import type { NormalizedEvent } from '../types';

const exam: NormalizedEvent = {
  kind: 'exam',
  key: 't9',
  date: '2027-01-20',
  start: '09:00',
  end: '11:00',
  title: 'Zkouška: Ekonomie I',
  location: 'Q02',
  description: 'zkouška\nreIS',
};

describe('toDesired', () => {
  it('gives exams a colour and the calendar default reminders', async () => {
    const d = await toDesired(exam);
    expect(d.id).toMatch(/^e[0-9a-v]{52}$/);
    expect(d.body.colorId).toBe('11');
    expect(d.body.reminders).toEqual({ useDefault: true });
    expect(d.body.start).toEqual({ dateTime: '2027-01-20T09:00:00', timeZone: 'Europe/Prague' });
    expect(d.body.extendedProperties.private).toEqual({
      reisKind: 'exam',
      reisHash: d.hash,
      reisV: '1',
    });
  });

  it('leaves custom events uncoloured and silent', async () => {
    const d = await toDesired({ ...exam, kind: 'custom', key: 'c7', title: 'Knihovna' });
    expect(d.id).toMatch(/^c[0-9a-v]{52}$/);
    expect(d.body.colorId).toBeUndefined();
    expect(d.body.reminders).toEqual({ useDefault: false, overrides: [] });
  });

  it('ends an overnight event on the next day, so Google accepts it', async () => {
    const d = await toDesired({ ...exam, kind: 'custom', start: '22:00', end: '01:00' });
    expect(d.body.start.dateTime).toBe('2027-01-20T22:00:00');
    expect(d.body.end.dateTime).toBe('2027-01-21T01:00:00');
  });
  it('rolls an overnight end over a month boundary', async () => {
    const d = await toDesired({ ...exam, date: '2027-01-31', start: '23:30', end: '00:30' });
    expect(d.body.end.dateTime).toBe('2027-02-01T00:30:00');
  });
});
