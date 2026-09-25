import { describe, it, expect, vi, beforeEach } from 'vitest';

const limit = vi.fn();
const order = vi.fn(() => ({ limit }));
const maybeSingle = vi.fn();
const selectEq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn((...args: unknown[]) => {
  void args;
  return { order, eq: selectEq };
});
const updateSelect = vi.fn();
const eq = vi.fn(() => ({ select: updateSelect }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn((...args: unknown[]) => {
  void args;
  return { select, update };
});

vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { from: (...args: unknown[]) => from(...args) },
}));

vi.mock('@/utils/reportError', () => ({
  logError: vi.fn(),
}));

import {
  listSuggestions,
  setSuggestionStatus,
  getSuggestionAttachments,
  hexToBytes,
} from '../suggestionsAdmin';
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
    if (result === null) throw new Error('expected rows, got null');
    // PII check: assert the field is present, never inspect its value.
    expect(result[0]).toHaveProperty('contact');
    expect(logError).not.toHaveBeenCalled();
  });

  it('returns null (does not throw) when Supabase returns an error', async () => {
    limit.mockResolvedValue({ data: null, error: { message: 'denied' } });
    const result = await listSuggestions();
    expect(result).toBeNull();
    expect(logError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logError).mock.calls[0]?.[0]).toBe('Api.listSuggestions');
  });

  it('returns [] when the query genuinely yields no rows', async () => {
    limit.mockResolvedValue({ data: [], error: null });
    const result = await listSuggestions();
    expect(result).toEqual([]);
    expect(logError).not.toHaveBeenCalled();
  });
});

describe('suggestionsAdmin.setSuggestionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the status through adminAuthClient and returns true on success', async () => {
    updateSelect.mockResolvedValue({ data: [{ id: 1 }], error: null });
    const ok = await setSuggestionStatus(1, 'done');
    expect(ok).toBe(true);
    expect(from).toHaveBeenCalledWith('suggestions');
    expect(update).toHaveBeenCalledWith({ status: 'done' });
    expect(eq).toHaveBeenCalledWith('id', 1);
    expect(logError).not.toHaveBeenCalled();
  });

  it('returns false (does not throw) when the write errors', async () => {
    updateSelect.mockResolvedValue({ data: null, error: { message: 'denied' } });
    const ok = await setSuggestionStatus(1, 'done');
    expect(ok).toBe(false);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logError).mock.calls[0]?.[0]).toBe('Api.setSuggestionStatus');
  });

  // PostgREST reports no error when an UPDATE matches zero rows, so without
  // .select('id') a row deleted meanwhile — or one RLS refuses — would report
  // success and strand the optimistic value on screen.
  it('returns false when the update matched no row', async () => {
    updateSelect.mockResolvedValue({ data: [], error: null });
    const ok = await setSuggestionStatus(99, 'done');
    expect(ok).toBe(false);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(logError).mock.calls[0]?.[0]).toBe('Api.setSuggestionStatus');
  });
});

describe('suggestionsAdmin attachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists only the attachment counts, never the bytes, and flattens the embed', async () => {
    limit.mockResolvedValue({
      data: [
        { ...row(1), suggestion_attachments: { has_screenshot: true, diagnostics_count: 3 } },
        { ...row(2), suggestion_attachments: [] },
        { ...row(3), suggestion_attachments: null },
      ],
      error: null,
    });
    const result = await listSuggestions();
    const cols = String(vi.mocked(select).mock.calls[0]![0]);
    expect(cols).toBe('*, suggestion_attachments(has_screenshot,diagnostics_count)');
    expect(result?.map((r) => r.attachments)).toEqual([
      { has_screenshot: true, diagnostics_count: 3 },
      null,
      null,
    ]);
    expect(result?.[0]).not.toHaveProperty('suggestion_attachments');
  });

  it('decodes a PostgREST bytea into a JPEG blob', async () => {
    maybeSingle.mockResolvedValue({
      data: { screenshot: '\\xffd8ff00', diagnostics: { entries: [] } },
      error: null,
    });
    const a = await getSuggestionAttachments(7);
    expect(from).toHaveBeenCalledWith('suggestion_attachments');
    expect(selectEq).toHaveBeenCalledWith('suggestion_id', 7);
    expect(a?.screenshot?.type).toBe('image/jpeg');
    expect(a?.screenshot?.size).toBe(4);
    expect(a?.diagnostics).toEqual({ entries: [] });
  });

  it('returns null when the read fails', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await getSuggestionAttachments(7)).toBeNull();
  });

  it('hexToBytes reads the \\x form', () => {
    expect([...hexToBytes('\\xff00a1')]).toEqual([255, 0, 161]);
  });
});
