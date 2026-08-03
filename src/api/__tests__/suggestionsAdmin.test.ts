import { describe, it, expect, vi, beforeEach } from 'vitest';

const limit = vi.fn();
const order = vi.fn(() => ({ limit }));
const select = vi.fn(() => ({ order }));
const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select, update }));

vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { from: (...args: unknown[]) => from(...args) },
}));

vi.mock('@/utils/reportError', () => ({
  logError: vi.fn(),
}));

import { listSuggestions, setSuggestionStatus } from '../suggestionsAdmin';
import { logError } from '@/utils/reportError';

function row(id: number) {
  return {
    id,
    type: 'bug' as const,
    title: 't',
    body: 'b',
    contact: null,
    screen: 'exams',
    ext_version: '4.0.0',
    browser_name: 'Chrome',
    browser_version: '131',
    viewport: '390x844',
    status: 'new' as const,
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

describe('suggestionsAdmin.listSuggestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads through adminAuthClient and returns the rows on success', async () => {
    limit.mockResolvedValue({ data: [row(1), row(2)], error: null });
    const result = await listSuggestions();
    expect(from).toHaveBeenCalledWith('suggestions');
    expect(result).toHaveLength(2);
    // PII check: assert the field is present, never inspect its value.
    expect(result[0]).toHaveProperty('contact');
    expect(logError).not.toHaveBeenCalled();
  });

  it('returns [] (does not throw) when Supabase returns an error', async () => {
    limit.mockResolvedValue({ data: null, error: { message: 'denied' } });
    const result = await listSuggestions();
    expect(result).toEqual([]);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logError).mock.calls[0][0]).toBe('Api.listSuggestions');
  });
});

describe('suggestionsAdmin.setSuggestionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the status through adminAuthClient and returns true on success', async () => {
    eq.mockResolvedValue({ error: null });
    const ok = await setSuggestionStatus(1, 'done');
    expect(ok).toBe(true);
    expect(from).toHaveBeenCalledWith('suggestions');
    expect(update).toHaveBeenCalledWith({ status: 'done' });
    expect(eq).toHaveBeenCalledWith('id', 1);
    expect(logError).not.toHaveBeenCalled();
  });

  it('returns false (does not throw) when the write errors', async () => {
    eq.mockResolvedValue({ error: { message: 'denied' } });
    const ok = await setSuggestionStatus(1, 'done');
    expect(ok).toBe(false);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logError).mock.calls[0][0]).toBe('Api.setSuggestionStatus');
  });
});
