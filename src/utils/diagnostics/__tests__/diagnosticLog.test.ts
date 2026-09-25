import { describe, it, expect, beforeEach } from 'vitest';
import {
  cleanMessage,
  recordDiagnostic,
  getDiagnostics,
  clearDiagnostics,
  setDiagnosticSource,
  DIAGNOSTIC_CAP,
} from '../diagnosticLog';

describe('cleanMessage', () => {
  it('drops the query and fragment of every URL', () => {
    expect(
      cleanMessage(
        'GET https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=123456;obdobi=789#x failed'
      )
    ).toBe('GET https://is.mendelu.cz/auth/student/terminy_seznam.pl failed');
  });

  it('masks email addresses', () => {
    expect(cleanMessage('no match for a.b@mendelu.cz here')).toBe('no match for ‹email› here');
  });

  it('masks coordinates before digit runs', () => {
    expect(cleanMessage('at 49.21025, 16.61503')).toBe('at ‹n›, ‹n›');
  });

  it('masks runs of five or more digits', () => {
    expect(cleanMessage('studium 1234567 not found')).toBe('studium ‹#› not found');
  });

  it('keeps short numbers such as HTTP statuses', () => {
    expect(cleanMessage('HTTP 404 on step 2')).toBe('HTTP 404 on step 2');
  });

  it('keeps only the first line', () => {
    expect(cleanMessage('first\n    at foo (bar.js:1:2)')).toBe('first');
  });

  it('caps at 200 characters', () => {
    expect(cleanMessage('x'.repeat(500))).toHaveLength(200);
  });

  it('uses the message of an Error, never its stack', () => {
    const e = new Error('boom');
    expect(cleanMessage(e)).toBe('boom');
  });

  it('stringifies anything else', () => {
    expect(cleanMessage(42)).toBe('42');
    expect(cleanMessage({ a: 1 })).toBe('[object Object]');
    expect(cleanMessage(undefined)).toBe('undefined');
  });
});

describe('diagnostic log', () => {
  beforeEach(() => {
    clearDiagnostics();
    setDiagnosticSource('app');
  });

  it('records a cleaned entry with the current source', () => {
    setDiagnosticSource('content');
    recordDiagnostic({ level: 'error', ctx: 'Api.fetchExams', msg: 'id 1234567', status: 503 });
    const [e] = getDiagnostics();
    expect(e).toMatchObject({
      level: 'error',
      source: 'content',
      ctx: 'Api.fetchExams',
      status: 503,
      msg: 'id ‹#›',
    });
    expect(typeof e!.t).toBe('number');
  });

  it(`keeps only the last ${DIAGNOSTIC_CAP}, oldest dropped`, () => {
    for (let i = 0; i < 60; i++) recordDiagnostic({ level: 'warn', ctx: null, msg: `m${i}` });
    const all = getDiagnostics();
    expect(all).toHaveLength(DIAGNOSTIC_CAP);
    expect(all[0]!.msg).toBe('m10');
    expect(all.at(-1)!.msg).toBe('m59');
  });

  it('returns a copy', () => {
    recordDiagnostic({ level: 'warn', ctx: null, msg: 'a' });
    getDiagnostics().length = 0;
    expect(getDiagnostics()).toHaveLength(1);
  });

  it('omits status when there is none', () => {
    recordDiagnostic({ level: 'warn', ctx: null, msg: 'a' });
    expect('status' in getDiagnostics()[0]!).toBe(false);
  });
});
