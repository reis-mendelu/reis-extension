import { describe, it, expect } from 'vitest';
import { needsPastZaznamnik, pastZaznamnikVerdict, zaznamnikPeriod } from '../pastSemester';

const PAST = { subjectId: '789', periodId: '300', hasPrubezne: true };

function state(over: Record<string, unknown> = {}) {
  return {
    impersonation: null,
    studiumId: '123',
    obdobiId: '456',
    zaznamnikHydrated: true,
    zaznamnik: {},
    zaznamnikLoading: {},
    subjects: { data: { PS: PAST } },
    ...over,
  } as never;
}

describe('zaznamnikPeriod', () => {
  it("is the subject's own period when it came from a past semester", () => {
    expect(zaznamnikPeriod({ periodId: '300' } as never, '456')).toBe('300');
  });
  it('is the current period for a current-semester subject', () => {
    expect(zaznamnikPeriod({} as never, '456')).toBe('456');
    expect(zaznamnikPeriod(undefined, '456')).toBe('456');
  });
});

describe('needsPastZaznamnik', () => {
  it('is true for a past subject with assessment and nothing stored', () => {
    expect(needsPastZaznamnik(state(), 'PS')).toBe(true);
  });
  it('is false for a current-semester subject: the sync owns those', () => {
    const subjects = { data: { PS: { ...PAST, periodId: '456' } } };
    expect(needsPastZaznamnik(state({ subjects }), 'PS')).toBe(false);
    const noPeriod = { data: { PS: { subjectId: '789', hasPrubezne: true } } };
    expect(needsPastZaznamnik(state({ subjects: noPeriod }), 'PS')).toBe(false);
  });
  it('is false once something is stored, a failure (null) included', () => {
    expect(needsPastZaznamnik(state({ zaznamnik: { PS: null } }), 'PS')).toBe(false);
    expect(needsPastZaznamnik(state({ zaznamnik: { PS: { ph: {}, vt: {} } } }), 'PS')).toBe(false);
  });
  it('waits for the IndexedDB hydration, which may already hold the points', () => {
    expect(needsPastZaznamnik(state({ zaznamnikHydrated: false }), 'PS')).toBe(false);
  });
  it('is false while impersonating, without a subject id or without assessment', () => {
    expect(needsPastZaznamnik(state({ impersonation: { x: 1 } }), 'PS')).toBe(false);
    const noId = { data: { PS: { ...PAST, subjectId: undefined } } };
    expect(needsPastZaznamnik(state({ subjects: noId }), 'PS')).toBe(false);
    const noFlags = { data: { PS: { ...PAST, hasPrubezne: false, hasTest: false } } };
    expect(needsPastZaznamnik(state({ subjects: noFlags }), 'PS')).toBe(false);
  });
  it('is false while a fetch for it is already running', () => {
    expect(needsPastZaznamnik(state({ zaznamnikLoading: { PS: true } }), 'PS')).toBe(false);
  });
});

describe('pastZaznamnikVerdict', () => {
  it('is fetch when everything it needs is there', () => {
    expect(pastZaznamnikVerdict(state(), 'PS')).toBe('fetch');
  });
  // The drawer can open (a notification, a cold start) before these arrive;
  // "wait" is what lets the store ask again once they do.
  it('waits for what is still on its way: hydration, the ids, the subject list, the subject', () => {
    expect(pastZaznamnikVerdict(state({ zaznamnikHydrated: false }), 'PS')).toBe('wait');
    expect(pastZaznamnikVerdict(state({ studiumId: null }), 'PS')).toBe('wait');
    expect(pastZaznamnikVerdict(state({ obdobiId: null }), 'PS')).toBe('wait');
    expect(pastZaznamnikVerdict(state({ subjects: null }), 'PS')).toBe('wait');
    expect(pastZaznamnikVerdict(state({ subjects: { data: {} } }), 'PS')).toBe('wait');
    // A cache from before periodId existed: the next sync folds it in.
    const noPeriod = { data: { PS: { subjectId: '789', hasPrubezne: true } } };
    expect(pastZaznamnikVerdict(state({ subjects: noPeriod }), 'PS')).toBe('wait');
  });
  it('skips what no later arrival can change', () => {
    expect(pastZaznamnikVerdict(state({ impersonation: { x: 1 } }), 'PS')).toBe('skip');
    const current = { data: { PS: { ...PAST, periodId: '456' } } };
    expect(pastZaznamnikVerdict(state({ subjects: current }), 'PS')).toBe('skip');
    expect(pastZaznamnikVerdict(state({ zaznamnik: { PS: null } }), 'PS')).toBe('skip');
    expect(pastZaznamnikVerdict(state({ zaznamnikLoading: { PS: true } }), 'PS')).toBe('skip');
  });
});
