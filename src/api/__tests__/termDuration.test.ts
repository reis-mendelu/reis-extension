import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

vi.mock('../../utils/reportError', () => ({
  logError: vi.fn(),
}));

vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));

import { parseDurationText, parseTermDurationPage, fetchTermDuration } from '../termDuration';
import { logError } from '../../utils/reportError';
import { fetchWithAuth } from '../client';

const REAL_FIXTURE = readFileSync(
  resolve(__dirname, 'fixtures/terminy-info-duration.html'),
  'utf8'
);

const wrapDoc = (bodyHtml: string): Document =>
  new DOMParser().parseFromString(
    `<!doctype html><html><body>${bodyHtml}</body></html>`,
    'text/html'
  );

const row = (label: string, value: string) =>
  `<table><tbody><tr><td class="odsazena" nowrap="nowrap"><b>${label}</b></td><td class="odsazena">${value}</td></tr></tbody></table>`;

describe('parseDurationText', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses the real observed format "10 minut"', () => {
    expect(parseDurationText('10 minut')).toBe(10);
  });

  it.each([
    ['1 minuta', 1],
    ['2 minuty', 2],
    ['45 minut', 45],
    ['90 minut', 90],
  ])('parses Czech minute declensions: %s', (raw, expected) => {
    expect(parseDurationText(raw)).toBe(expected);
  });

  it.each([
    ['1 hodina', 60],
    ['2 hodiny', 120],
    ['5 hodin', 300],
  ])('parses Czech hour declensions: %s', (raw, expected) => {
    expect(parseDurationText(raw)).toBe(expected);
  });

  it.each([
    ['1 hodina 30 minut', 90],
    ['2 hodiny 15 minut', 135],
  ])('parses combined hours + minutes: %s', (raw, expected) => {
    expect(parseDurationText(raw)).toBe(expected);
  });

  it.each([
    ['10 minutes', 10],
    ['1 minute', 1],
    ['2 hours', 120],
    ['1 hour 30 minutes', 90],
  ])('parses English equivalents: %s', (raw, expected) => {
    expect(parseDurationText(raw)).toBe(expected);
  });

  it.each([
    ['1:30', 90],
    ['0:45', 45],
    ['2:05', 125],
  ])('parses H:MM clock format: %s', (raw, expected) => {
    expect(parseDurationText(raw)).toBe(expected);
  });

  it('normalizes non-breaking spaces', () => {
    expect(parseDurationText('90 minut')).toBe(90);
  });

  it.each(['-- nezadáno --', '-- not specified --', '', '   '])(
    'returns null for IS empty sentinel %s without telemetry',
    (raw) => {
      expect(parseDurationText(raw)).toBeNull();
      expect(logError).not.toHaveBeenCalled();
    }
  );

  it('returns null and reports telemetry for an unrecognised format', () => {
    expect(parseDurationText('půl dne')).toBeNull();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logError).mock.calls[0]![0]).toBe('Parser.parseDurationText');
  });

  it('rejects a zero or negative duration rather than returning 0', () => {
    expect(parseDurationText('0 minut')).toBeNull();
  });

  it('rejects an implausibly long duration', () => {
    // Guards against a mis-parse silently producing a multi-day calendar block.
    expect(parseDurationText('99 hodin')).toBeNull();
  });
});

describe('parseTermDurationPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('extracts 10 minutes from the real scrubbed IS Mendelu page', () => {
    const doc = new DOMParser().parseFromString(REAL_FIXTURE, 'text/html');
    expect(parseTermDurationPage(doc)).toBe(10);
  });

  it('reads the English label', () => {
    const doc = wrapDoc(row('Length of event:', '90 minutes'));
    expect(parseTermDurationPage(doc)).toBe(90);
  });

  it('returns null when no duration row exists', () => {
    const doc = wrapDoc(row('Poznámka:', 'Bring student ID.'));
    expect(parseTermDurationPage(doc)).toBeNull();
  });

  it('returns null when the duration is the IS empty sentinel', () => {
    const doc = wrapDoc(row('Délka trvání akce:', '-- nezadáno --'));
    expect(parseTermDurationPage(doc)).toBeNull();
  });

  it('does not confuse a different label that contains the word minut', () => {
    const doc = wrapDoc(row('Poznámka:', 'Přijďte 10 minut předem.'));
    expect(parseTermDurationPage(doc)).toBeNull();
  });
});

describe('fetchTermDuration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the parsed duration for a valid detail page', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(new Response(REAL_FIXTURE));
    await expect(fetchTermDuration('339715', '111', '222')).resolves.toBe(10);
  });

  it('requests the term detail page for the given ids', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(new Response(REAL_FIXTURE));
    await fetchTermDuration('339715', '111', '222');
    const url = vi.mocked(fetchWithAuth).mock.calls[0]![0];
    expect(url).toContain('terminy_info.pl');
    expect(url).toContain('termin=339715');
    expect(url).toContain('studium=111');
    expect(url).toContain('obdobi=222');
  });

  it('throws when the response is not a term detail page (auth redirect)', async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(new Response('<html><body>Login</body></html>'));
    await expect(fetchTermDuration('339715', '111', '222')).rejects.toThrow();
  });
});
