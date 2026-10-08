import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDualLanguageExams } from '../exams';
import * as client from '../client';
import * as userParams from '../../utils/userParams';

vi.mock('../client');
vi.mock('../../utils/userParams');
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

/**
 * Návrhy #26: with IS unreachable, `fetchExamData` swallowed both failures into
 * `[]`, `fetchDualLanguageExams` merged two empty lists, and the sync reported
 * exams as answered — "Žádné zkoušky", and `exams: "success", examsCount: 0` in
 * the diagnostics. When NEITHER language could be fetched there is no answer,
 * and the caller has to be told so. One language answering is still an answer.
 */

const EMPTY_PAGE = '<html><body><p>Žádné termíny</p></body></html>';
const html = (body: string) =>
  new Response(body, { status: 200, headers: { 'Content-Type': 'text/html' } });

describe('fetchDualLanguageExams with IS unreachable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userParams.getUserParams).mockResolvedValue({
      studium: '111',
      obdobi: '222',
    } as Awaited<ReturnType<typeof userParams.getUserParams>>);
  });

  it('rejects when neither language could be fetched', async () => {
    vi.mocked(client.fetchWithAuth).mockRejectedValue(
      new Error('Unable to resolve host "is.mendelu.cz"')
    );

    await expect(fetchDualLanguageExams()).rejects.toThrow();
  });

  it('resolves [] when IS answered and there are simply no exams', async () => {
    vi.mocked(client.fetchWithAuth).mockImplementation(async () => html(EMPTY_PAGE));

    await expect(fetchDualLanguageExams()).resolves.toEqual([]);
  });

  it('resolves when only one language failed', async () => {
    vi.mocked(client.fetchWithAuth).mockImplementation(async (url: string) => {
      if (url.includes('lang=en')) throw new Error('blip');
      return html(EMPTY_PAGE);
    });

    await expect(fetchDualLanguageExams()).resolves.toEqual([]);
  });
});
