import { describe, it, expect, vi, beforeEach } from 'vitest';
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
});
