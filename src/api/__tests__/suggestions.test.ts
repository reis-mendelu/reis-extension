import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSuggestionPayload, resolveScreen, submitSuggestion } from '../suggestions';

describe('buildSuggestionPayload', () => {
  it('sends the reIS screen and never the host URL', () => {
    const p = buildSuggestionPayload({ type: 'bug', title: 'T', body: 'B' }, 'exams');
    expect(p.screen).toBe('exams');
    expect(JSON.stringify(p)).not.toContain('mendelu.cz');
    expect(JSON.stringify(p)).not.toContain('http');
  });

  it('carries the optional contact through', () => {
    const p = buildSuggestionPayload(
      { type: 'idea', title: 'T', body: 'B', contact: 'a@b.cz' },
      'map'
    );
    expect(p.contact).toBe('a@b.cz');
  });
});

describe('resolveScreen', () => {
  it('accepts a known AppView', () => {
    expect(resolveScreen('studyPlan')).toBe('studyPlan');
  });

  it('falls back to calendar for anything unknown', () => {
    expect(resolveScreen('https://is.mendelu.cz/auth/?studium=123')).toBe('calendar');
    expect(resolveScreen(undefined)).toBe('calendar');
    expect(resolveScreen(42)).toBe('calendar');
  });
});

describe('submitSuggestion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Real builds inject this. There is deliberately no in-code fallback, so
    // without it every call short-circuits before fetch — see the last test.
    vi.stubEnv('VITE_EXTENSION_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('maps 429 to rate_limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    );
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('maps 400 to invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({}) })
    );
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'invalid' });
  });

  it('maps a network throw to offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'offline' });
  });

  it('returns ok on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    );
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: true });
  });

  // The header used to fall back to a literal 'reis-secret'. That shipped a
  // secret-shaped string in the public bundle that was not the secret: the
  // function 401s it, and the only signal was the generic failure toast.
  // A misconfigured build must not reach the network at all.
  it('never sends a fallback secret when the env var is missing', async () => {
    vi.stubEnv('VITE_EXTENSION_SECRET', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, error: 'upstream' });
  });
});
