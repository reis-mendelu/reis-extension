import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSuggestionPayload, resolveScreen, submitSuggestion } from '../suggestions';
import { supabase } from '@/services/spolky/supabaseClient';

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

vi.mock('@/services/spolky/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}));

describe('submitSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // No credential is stubbed and none is needed. The old edge function gated on
  // a `x-reis-extension-secret` header whose value shipped inside the bundle —
  // readable by anyone who unzipped the extension, so it was an identifier, not
  // a credential. Authorization is server-side now and unchanged: `suggestions`
  // is deny-all RLS with no insert grant to anon, so the SECURITY DEFINER RPC is
  // the only path to a row.
  it('writes through the RPC with no client credential', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as never);

    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });

    expect(r).toEqual({ ok: true });
    const [fn, args] = vi.mocked(supabase.rpc).mock.calls[0]!;
    expect(fn).toBe('submit_suggestion');
    expect(args).toMatchObject({ p_type: 'bug', p_title: 'T', p_body: 'B' });
    // Nothing secret-shaped may travel with the payload.
    expect(JSON.stringify(args)).not.toMatch(/secret/i);
  });

  // The RPC returns false for BOTH a validation failure and the flood guard, so
  // the old 400-vs-429 split is not recoverable here. The client enforces the
  // same limits with maxLength, so an invalid payload from the real UI is
  // unreachable; 'rate_limited' is the honest reading and matches the copy.
  it('maps a false result to rate_limited', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: false, error: null } as never);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('maps an RPC error to upstream', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    } as never);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'upstream' });
  });

  it('maps a thrown network failure to offline', async () => {
    vi.mocked(supabase.rpc).mockRejectedValue(new Error('down') as never);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'offline' });
  });
});
