/**
 * The guards that exist so IS HTML drift shows up as a reported error instead of
 * NaN and undefined flowing into the student's grades and timetable. CLAUDE.md
 * calls the column-index constants load-bearing; these are what makes a wrong
 * index LOUD rather than silently producing a plausible-looking wrong number.
 *
 * The module had no test file at all, so every guard could be softened to a
 * no-op without anything noticing — which is the one change that would restore
 * exactly the silent corruption they were written to prevent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logError = vi.hoisted(() => vi.fn());
vi.mock('../../reportError', () => ({ logError }));

import { ParserError, parseRequiredInt, parseOptionalInt, requireCell } from '../parserGuards';

beforeEach(() => vi.clearAllMocks());

describe('ParserError', () => {
  it('names the field and the context in its message', () => {
    // The message is what lands in telemetry; without both, a drift report says
    // "parse failed" and nothing about WHERE.
    const e = new ParserError('credits', 'subjectsTable', 'parseInt failed');

    expect(e.message).toBe('[subjectsTable] credits: parseInt failed');
    expect(e.name).toBe('ParserError');
    expect(e.field).toBe('credits');
    expect(e.context).toBe('subjectsTable');
  });

  it('is a real Error, so try/catch at the row boundary works', () => {
    const e = new ParserError('f', 'c', 'm');

    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(ParserError);
  });

  it('carries an optional row snippet for diagnosis', () => {
    const e = new ParserError('f', 'c', 'm', '<tr><td>x</td></tr>');

    expect(e.snippet).toBe('<tr><td>x</td></tr>');
  });
});

describe('parseRequiredInt', () => {
  it('parses a plain integer', () => {
    expect(parseRequiredInt('42', 'credits', 'ctx')).toBe(42);
  });

  it('parses a number with trailing text, as parseInt does', () => {
    expect(parseRequiredInt('5 kreditů', 'credits', 'ctx')).toBe(5);
  });

  it('THROWS rather than returning NaN', () => {
    // Returning NaN here is the silent corruption this module exists to stop: it
    // propagates into totals and averages and renders as "NaN" or 0.
    expect(() => parseRequiredInt('nic', 'credits', 'subjects')).toThrow(ParserError);
  });

  it('quotes the offending text in the error, so drift is diagnosable', () => {
    expect(() => parseRequiredInt('nic', 'credits', 'subjects')).toThrow(/"nic"/);
  });

  it('throws on empty text', () => {
    expect(() => parseRequiredInt('', 'credits', 'subjects')).toThrow(ParserError);
  });
});

describe('parseOptionalInt', () => {
  it('parses a value when present', () => {
    expect(parseOptionalInt('7', 'points', 'ctx')).toBe(7);
  });

  it('returns null for genuinely empty text without reporting', () => {
    // An empty optional cell is normal IS output, not drift.
    expect(parseOptionalInt('', 'points', 'ctx')).toBeNull();
    expect(logError).not.toHaveBeenCalled();
  });

  it('parses a numeric prefix rather than reporting it', () => {
    expect(parseOptionalInt('12abc-', 'points', 'zaznamnik')).toBe(12);
    expect(logError).not.toHaveBeenCalled();
  });

  it('does not report a lone sign', () => {
    expect(parseOptionalInt('+', 'points', 'zaznamnik')).toBeNull();
    expect(parseOptionalInt('-', 'points', 'zaznamnik')).toBeNull();
    expect(logError).not.toHaveBeenCalled();
  });

  /**
   * The soft-log inside parseOptionalInt appears UNREACHABLE, and this test
   * records that rather than pretending otherwise.
   *
   * It fires only when `parseInt` returns NaN AND the text matches /^[-+]?\d/.
   * But a string starting with an optional sign followed by a digit is exactly
   * what parseInt succeeds on, so the two conditions cannot both hold. Probed
   * '+', '-', '12abc', '+5', '1e', '0x', ' 5', '+.5', a 400-digit run and a
   * non-ASCII numeral: none reaches it.
   *
   * Left in place rather than deleted — it is a cheap guard against a future
   * parseInt change — but nobody should count on the drift signal it promises.
   * If a reachable input is ever found, this test is where to assert it.
   */
  it('has no known input that triggers its drift report', () => {
    const probes = ['+', '-', '12abc', '+5', '-3', '1e', '0x', ' 5', '+.5', '1.2.3'];

    for (const p of probes) parseOptionalInt(p, 'points', 'zaznamnik');

    expect(logError).not.toHaveBeenCalled();
  });

  it('stays SILENT for pure text, which means a wrong column, not drift', () => {
    // Deliberately a different class of bug: logging it here would bury the
    // drift signal under noise from every mis-indexed read.
    expect(parseOptionalInt('Zápočet', 'points', 'zaznamnik')).toBeNull();

    expect(logError).not.toHaveBeenCalled();
  });
});

describe('requireCell', () => {
  const cells = ['a', 'b', 'c'].map((t) => {
    const td = document.createElement('td');
    td.textContent = t;
    return td;
  });

  it('returns the cell at a valid index', () => {
    expect(requireCell(cells, 1, 'name', 'ctx').textContent).toBe('b');
  });

  it('THROWS when the index is past the end — the column-drift signature', () => {
    // A column removed upstream turns every later index into undefined. Throwing
    // is what turns that into one reported error instead of a table of blanks.
    expect(() => requireCell(cells, 3, 'name', 'subjects')).toThrow(ParserError);
  });

  it('throws on a negative index', () => {
    expect(() => requireCell(cells, -1, 'name', 'subjects')).toThrow(ParserError);
  });

  it('reports the index AND the actual length, so the drift is obvious', () => {
    expect(() => requireCell(cells, 9, 'name', 'subjects')).toThrow(/index 9.*length 3/);
  });

  it('throws when the cell exists but is null', () => {
    // Sparse arrays reach here from getElementsByTagName in some paths.
    const sparse = [cells[0], undefined, cells[2]] as unknown as ArrayLike<Element>;

    expect(() => requireCell(sparse, 1, 'name', 'subjects')).toThrow(/is null/);
  });

  it('passes the row snippet through for diagnosis', () => {
    try {
      requireCell(cells, 9, 'name', 'subjects', '<tr>…</tr>');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as ParserError).snippet).toBe('<tr>…</tr>');
    }
  });
});
