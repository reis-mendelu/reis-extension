import { describe, it, expect } from 'vitest';
import { classifyIsPage, isLoginForm, notUnderstood } from '../isPage';
import { cleanMessage } from '../../utils/diagnostics/diagnosticLog';

/**
 * The two rules every IS read classified here obeys:
 *   R1 — rows offered and none understood is "not understood", never "empty".
 *   R2 — IS's login form is never an answer, not even an empty one.
 * And the one they must never break: what the parser understood is data.
 */
describe('classifyIsPage', () => {
  const page = (rows: number, loginForm = false) => ({ rows, loginForm });

  it('is data whenever the parser understood something', () => {
    expect(classifyIsPage(['a'], 1, page(5))).toEqual({ kind: 'data', value: ['a'] });
    // Fewer understood than offered is still data: list.pl offers rows the
    // subject parser skips on purpose (13 offered, 8 read on a real page).
    expect(classifyIsPage(['a'], 1, page(13)).kind).toBe('data');
  });

  it('R1: rows offered and none understood is unrecognised, never empty', () => {
    expect(classifyIsPage([], 0, page(3))).toEqual({ kind: 'unrecognised', shape: page(3) });
  });

  it('is empty when the page offered nothing and is not the login form', () => {
    expect(classifyIsPage([], 0, page(0))).toEqual({ kind: 'empty' });
  });

  it('R2: the login form is unrecognised, not empty', () => {
    expect(classifyIsPage([], 0, page(0, true)).kind).toBe('unrecognised');
  });
});

describe('isLoginForm', () => {
  it('recognises the form IS answers a lapsed session with', () => {
    // The password field of IS's login page, as a signed-out list.pl returned it.
    expect(isLoginForm('<form><input type="password" name="credential_1"></form>')).toBe(true);
  });

  it('does not fire on a signed-in page', () => {
    expect(isLoginForm('<a href="/system/logout.pl">Odhlásit</a><table></table>')).toBe(false);
  });
});

describe('notUnderstood', () => {
  const err = notUnderstood('subjects', { rows: 3, loginForm: false, table: true });

  it('puts the shape in the first line, which is all the diagnostic log keeps', () => {
    const line = 'subjects page not understood: rows=3 loginForm=false table=true';
    expect(err.message.split('\n')[0]).toBe(line);
    expect(cleanMessage(err)).toBe(line);
  });
});
