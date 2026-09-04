import { describe, it, expect } from 'vitest';
import { formatIsDate, rebaseFixture, applyFixture } from '../fixtureRebase';

/** Shape of a rebased fixture, just deep enough for these assertions. */
type Rebased = {
  exams: {
    sections: {
      terms: Record<string, unknown>[];
      registeredTerm?: Record<string, unknown>;
    }[];
  }[];
};
const asRebased = (v: unknown) => v as unknown as Rebased;

const NOW = new Date('2026-02-10T08:30:00');

describe('formatIsDate', () => {
  it('formats as zero-padded DD.MM.YYYY', () => {
    expect(formatIsDate(new Date('2026-02-03T00:00:00'))).toBe('03.02.2026');
    expect(formatIsDate(new Date('2026-12-31T00:00:00'))).toBe('31.12.2026');
  });
});

describe('rebaseFixture', () => {
  const fixture = {
    exams: [
      {
        version: 1,
        id: 's1',
        name: 'Matematika',
        code: 'EBC-MAT',
        sections: [
          {
            id: 'sec1',
            name: 'zkouška',
            type: 'Zkouška',
            status: 'open',
            terms: [
              { id: 't1', dayOffset: 0, time: '09:00' },
              { id: 't2', dayOffset: 7, time: '11:00', deregDayOffset: 5, deregTime: '23:59' },
              {
                id: 't3',
                dayOffset: -3,
                time: '08:00',
                regStartDayOffset: -20,
                regEndDayOffset: -4,
              },
            ],
          },
        ],
      },
    ],
  };

  const out = rebaseFixture(fixture, NOW) as typeof fixture & { lastSync: number };
  const terms = out.exams[0]!.sections[0]!.terms;

  it('turns dayOffset 0 into today', () => {
    expect(terms[0]!).toMatchObject({ date: '10.02.2026', time: '09:00' });
  });

  it('projects positive and negative offsets', () => {
    expect(terms[1]!).toMatchObject({ date: '17.02.2026' });
    expect(terms[2]!).toMatchObject({ date: '07.02.2026' });
  });

  it('crosses month boundaries correctly', () => {
    const late = asRebased(
      rebaseFixture({ exams: [{ sections: [{ terms: [{ dayOffset: 20, time: '09:00' }] }] }] }, NOW)
    );
    expect(late.exams[0]!.sections[0]!.terms[0]!['date']).toBe('02.03.2026');
  });

  it('builds a deregistration deadline with its time', () => {
    expect(terms[1]!).toMatchObject({ deregistrationDeadline: '15.02.2026 23:59' });
  });

  it('projects registration window offsets', () => {
    expect(terms[2]!).toMatchObject({
      registrationStart: '21.01.2026',
      registrationEnd: '06.02.2026',
    });
  });

  it('strips the offset authoring keys from the output', () => {
    for (const t of terms) {
      expect(t).not.toHaveProperty('dayOffset');
      expect(t).not.toHaveProperty('deregDayOffset');
      expect(t).not.toHaveProperty('deregTime');
      expect(t).not.toHaveProperty('regStartDayOffset');
    }
  });

  it('rebases a registeredTerm on a section', () => {
    const withReg = asRebased(
      rebaseFixture(
        { exams: [{ sections: [{ registeredTerm: { dayOffset: 2, time: '14:00' }, terms: [] }] }] },
        NOW
      )
    );
    expect(withReg.exams[0]!.sections[0]!.registeredTerm!['date']).toBe('12.02.2026');
  });

  it('stamps lastSync to now so the harness never treats it as stale', () => {
    expect(out.lastSync).toBe(NOW.getTime());
  });

  it('leaves a term that already has an absolute date untouched', () => {
    const absolute = asRebased(
      rebaseFixture(
        { exams: [{ sections: [{ terms: [{ date: '01.01.2027', time: '09:00' }] }] }] },
        NOW
      )
    );
    expect(absolute.exams[0]!.sections[0]!.terms[0]!['date']).toBe('01.01.2027');
  });

  it('does not mutate the input fixture', () => {
    const input = { exams: [{ sections: [{ terms: [{ dayOffset: 1, time: '09:00' }] }] }] };
    rebaseFixture(input, NOW);
    expect(input.exams[0]!.sections[0]!.terms[0]!).toHaveProperty('dayOffset', 1);
  });

  it('tolerates a fixture with no exams', () => {
    expect(() => rebaseFixture({}, NOW)).not.toThrow();
  });
});

describe('applyFixture', () => {
  it('overlays fixture keys onto the base snapshot', () => {
    const base = { subjects: { data: 1 }, exams: [], lastSync: 1 };
    const out = applyFixture(base, { exams: [{ id: 'x' }], lastSync: 2 });
    expect(out).toEqual({ subjects: { data: 1 }, exams: [{ id: 'x' }], lastSync: 2 });
  });

  it('works with no base snapshot at all', () => {
    expect(applyFixture({}, { exams: [{ id: 'x' }] })).toEqual({ exams: [{ id: 'x' }] });
  });

  it('keeps base keys the fixture does not mention', () => {
    const out = applyFixture({ files: { a: 1 } }, { exams: [] });
    expect(out).toHaveProperty('files');
  });
});

describe('rebaseFixture — schedule', () => {
  // Lessons are seasonal in exactly the way exam terms are: a July scrape has
  // an empty schedule, so the Calendar screen — the app's home tab — could not
  // be looked at locally at all outside the semester. That blind spot is how a
  // day switcher anchored to the wrong week survived review.
  //
  // Schedule dates are IS's COMPACT form (YYYYMMDD), not the DD.MM.YYYY the
  // exam terms use, so they need their own projection.
  const NOW = new Date('2026-04-22T10:00:00');

  it('projects a lesson dayOffset onto the compact IS date', () => {
    const out = rebaseFixture({ schedule: [{ id: 'a', dayOffset: 0 }] }, NOW);
    expect((out.schedule as Record<string, unknown>[])[0]).toMatchObject({ date: '20260422' });
  });

  it('projects negative and positive offsets across a month boundary', () => {
    const out = rebaseFixture(
      {
        schedule: [
          { id: 'a', dayOffset: -30 },
          { id: 'b', dayOffset: 9 },
        ],
      },
      NOW
    );
    const rows = out.schedule as Record<string, unknown>[];
    expect(rows[0]!.date).toBe('20260323');
    expect(rows[1]!.date).toBe('20260501');
  });

  it('strips the offset key and leaves an absolute date alone', () => {
    const out = rebaseFixture(
      {
        schedule: [
          { id: 'a', dayOffset: 1 },
          { id: 'b', date: '20260101' },
        ],
      },
      NOW
    );
    const rows = out.schedule as Record<string, unknown>[];
    expect(rows[0]).not.toHaveProperty('dayOffset');
    expect(rows[1]!.date).toBe('20260101');
  });
});

describe('rebaseFixture: odevzdávárny', () => {
  // The deadline feed — and so the Novinky sheet's whole first group — only
  // shows an assignment inside a 48-hour window. Absolute dates in a fixture
  // would put that group back in its empty state within two days of being
  // written, which is the rot `dayOffset` exists to prevent.
  it('materialises an assignment deadline from its offset', () => {
    const out = rebaseFixture(
      {
        odevzdavarny: [
          { odevzdavarnaId: 'a1', name: 'Projekt', deadlineDayOffset: 0, deadlineTime: '23:59' },
          { odevzdavarnaId: 'a2', name: 'Protokol', deadlineDayOffset: 1, deadlineTime: '12:00' },
        ],
      },
      NOW
    ) as unknown as { odevzdavarny: Record<string, unknown>[] };

    expect(out.odevzdavarny[0]!['deadline']).toBe('10.02.2026 23:59');
    expect(out.odevzdavarny[1]!['deadline']).toBe('11.02.2026 12:00');
    expect(out.odevzdavarny[0]).not.toHaveProperty('deadlineDayOffset');
    expect(out.odevzdavarny[0]).not.toHaveProperty('deadlineTime');
  });

  it('leaves an assignment that already carries an absolute deadline alone', () => {
    const out = rebaseFixture(
      { odevzdavarny: [{ odevzdavarnaId: 'a1', deadline: '01.01.2026 09:00' }] },
      NOW
    ) as unknown as { odevzdavarny: Record<string, unknown>[] };
    expect(out.odevzdavarny[0]!['deadline']).toBe('01.01.2026 09:00');
  });
});

