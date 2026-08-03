import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSuggestionsSlice, type SuggestionsSlice } from '../createSuggestionsSlice';
import type { SuggestionRow } from '../../../types/suggestions';

const listSuggestions = vi.fn();
const setSuggestionStatus = vi.fn();
vi.mock('../../../api/suggestionsAdmin', () => ({
  listSuggestions: () => listSuggestions(),
  setSuggestionStatus: (id: number, status: string) => setSuggestionStatus(id, status),
}));

function row(id: number, status: SuggestionRow['status']): SuggestionRow {
  return {
    id,
    type: 'bug',
    title: `t${id}`,
    body: 'b',
    contact: null,
    screen: 'exams',
    ext_version: '4.0.0',
    browser_name: 'Chrome',
    browser_version: '131',
    viewport: '390x844',
    status,
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

describe('createSuggestionsSlice', () => {
  let state: SuggestionsSlice;
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listSuggestions.mockReset();
    setSuggestionStatus.mockReset();
    setSuggestionStatus.mockResolvedValue(true);
    set = vi.fn((updater) => {
      const patch = typeof updater === 'function' ? updater(state) : updater;
      state = { ...state, ...patch };
    });
    get = vi.fn(() => state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state = createSuggestionsSlice(set, get, {} as any);
  });

  it('starts empty with nothing unread', () => {
    expect(state.suggestions).toEqual([]);
    expect(state.suggestionsUnread).toBe(0);
  });

  it('counts only new items as unread', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new'), row(2, 'done'), row(3, 'new')]);
    await state.loadSuggestions();
    expect(state.suggestions).toHaveLength(3);
    expect(state.suggestionsUnread).toBe(2);
  });

  it('updates status optimistically and recounts unread', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new'), row(2, 'new')]);
    await state.loadSuggestions();
    await state.updateSuggestionStatus(1, 'done');
    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('done');
    expect(state.suggestionsUnread).toBe(1);
  });

  it('reverts the optimistic update when the write fails', async () => {
    listSuggestions.mockResolvedValue([row(1, 'new')]);
    await state.loadSuggestions();
    setSuggestionStatus.mockResolvedValue(false);
    await state.updateSuggestionStatus(1, 'done');
    expect(state.suggestions.find((s) => s.id === 1)?.status).toBe('new');
    expect(state.suggestionsUnread).toBe(1);
  });
});
