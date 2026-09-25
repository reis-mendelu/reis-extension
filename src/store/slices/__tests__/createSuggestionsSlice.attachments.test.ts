import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSuggestionAttachments = vi.fn();
const setSuggestionStatus = vi.fn();
vi.mock('../../../api/suggestionsAdmin', () => ({
  listSuggestions: vi.fn(async () => []),
  setSuggestionStatus: (...a: unknown[]) => setSuggestionStatus(...a),
  getSuggestionAttachments: (...a: unknown[]) => getSuggestionAttachments(...a),
}));

import { useAppStore } from '../../useAppStore';
import type { SuggestionRow } from '../../../types/suggestions';

const row = {
  id: 1,
  type: 'bug',
  title: 't',
  body: 'b',
  contact: null,
  screen: 'exams',
  ext_version: '5',
  browser_name: 'Chrome',
  browser_version: '131',
  viewport: '1x1',
  status: 'new',
  created_at: '2026-09-25T00:00:00.000Z',
  attachments: { has_screenshot: true, diagnostics_count: 2 },
} as SuggestionRow;

describe('suggestion attachments in the store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ suggestions: [row], suggestionAttachments: {}, suggestionsPending: [] });
  });

  it('loads once and caches', async () => {
    const a = { screenshot: null, diagnostics: null };
    getSuggestionAttachments.mockResolvedValue(a);
    await useAppStore.getState().loadSuggestionAttachments(1);
    await useAppStore.getState().loadSuggestionAttachments(1);
    expect(getSuggestionAttachments).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().suggestionAttachments[1]).toBe(a);
  });

  it('records a failed read so it can be retried', async () => {
    getSuggestionAttachments.mockResolvedValueOnce(null).mockResolvedValueOnce({
      screenshot: null,
      diagnostics: null,
    });
    await useAppStore.getState().loadSuggestionAttachments(1);
    expect(useAppStore.getState().suggestionAttachments[1]).toBe('error');
    await useAppStore.getState().loadSuggestionAttachments(1);
    expect(getSuggestionAttachments).toHaveBeenCalledTimes(2);
  });

  it('marking done forgets the attachments, as the server trigger deletes them', async () => {
    setSuggestionStatus.mockResolvedValue(true);
    useAppStore.setState({ suggestionAttachments: { 1: { screenshot: null, diagnostics: null } } });
    await useAppStore.getState().updateSuggestionStatus(1, 'done');
    expect(useAppStore.getState().suggestions[0]!.attachments).toBeNull();
    expect(useAppStore.getState().suggestionAttachments[1]).toBeUndefined();
  });

  it('drops an attachment read that lands after the report was marked done', async () => {
    let finish: (v: unknown) => void = () => {};
    getSuggestionAttachments.mockImplementation(() => new Promise((r) => (finish = r)));
    setSuggestionStatus.mockResolvedValue(true);
    const loading = useAppStore.getState().loadSuggestionAttachments(1);
    await useAppStore.getState().updateSuggestionStatus(1, 'done');
    finish({ screenshot: 'data:image/jpeg;base64,/9j/', diagnostics: null });
    await loading;
    expect(useAppStore.getState().suggestionAttachments[1]).toBeUndefined();
  });
});
