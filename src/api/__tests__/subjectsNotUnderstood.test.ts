import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDualLanguageSubjects } from '../subjects';
import * as client from '../client';
import { logError } from '../../utils/reportError';

vi.mock('../client', async (orig) => ({
  ...(await orig<typeof import('../client')>()),
  fetchWithAuth: vi.fn(),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

/**
 * Reports 30, 41 and 42: "Subjects: list is empty". A list.pl the parser could
 * not read came back as `{ data: {} }`, which is truthy, so the sync stored it
 * over the student's subjects. An unrecognised page is now a failed read
 * (`null`), and a page that offered no rows is still empty, as before.
 *
 * Rows mirror the real list.pl row (`tr.uis-hl-table` in `#tmtab_1`, the
 * syllabus link in the first cell, a relative dok_server folder link). Codes,
 * names and ids are made up.
 */
const SIGNED_IN = '<a href="/system/logout.pl?lang=cz">Odhlásit</a>';
const FOLDER = '../dok_server/slozka.pl?ds=1;id=1001;lang=cz';
const row = (code: string, id: number, folder = FOLDER) =>
  `<tr class=" uis-hl-table"><td class="odsazena" nowrap="1" align="left">` +
  `<a href="/auth/katalog/syllabus.pl?predmet=${id};lang=cz">${code} Smyšlený předmět (ZS 2026/2027 - PEF)</a>` +
  `</td><td class="odsazena" align="left">př+cv</td>` +
  `<td class="odsazena" align="center"><a href="${folder}">D</a></td></tr>`;
const table = (rows: string) =>
  `<table id="tmtab_1"><tr class=" zahlavi"><th>Předmět</th><th>Forma</th><th>Dok.</th></tr>${rows}</table>`;
const page = (body: string) => `<html><body>${SIGNED_IN}${body}</body></html>`;

function serve(html: string) {
  vi.mocked(client.fetchWithAuth).mockImplementation(
    async () => new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } })
  );
}

const notUnderstoodCalls = () =>
  vi
    .mocked(logError)
    .mock.calls.filter(([, e]) => e instanceof Error && /not understood/.test(e.message));

describe('fetchDualLanguageSubjects on a page it does not understand', () => {
  beforeEach(() => vi.clearAllMocks());

  it('still reads a real-shaped page into the same subjects', async () => {
    serve(page(table(row('XX1', 101) + row('XX2', 102))));

    const result = await fetchDualLanguageSubjects('1', '2');

    expect(Object.keys(result!.subjects.data)).toEqual(['XX1', 'XX2']);
    expect(result!.subjects.data.XX1!.subjectId).toBe('101');
    expect(notUnderstoodCalls()).toHaveLength(0);
  });

  it('R1: rows offered and none read is a failed read, never an empty list', async () => {
    // The folder link moved: every row lacks the one the parser requires.
    const moved = '../dokumenty/slozka.pl?id=1001';
    serve(page(table(row('XX1', 101, moved) + row('XX2', 102, moved) + row('XX3', 103, moved))));

    await expect(fetchDualLanguageSubjects('1', '2')).resolves.toBeNull();

    const [call] = notUnderstoodCalls();
    expect(call![0]).toBe('Api.fetchDualLanguageSubjects');
    const line = (call![1] as Error).message.split('\n')[0]!;
    expect(line).toMatch(/^subjects page not understood: .*\brows=3\b.*\bfolderLinks=0\b/);
    // Counts and booleans only: nothing from the page itself.
    expect(line).not.toMatch(/XX\d|Smyšlený|predmet|slozka|dokumenty/);
  });

  it('R2: the login form is a failed read, never an empty list', async () => {
    serve(
      '<html><body><form><input name="credential_0"><input type="password" name="credential_1"></form></body></html>'
    );

    await expect(fetchDualLanguageSubjects('1', '2')).resolves.toBeNull();
    expect(notUnderstoodCalls()).toHaveLength(1);
  });

  it('keeps a page with no subject rows empty, exactly as today', async () => {
    for (const body of ['<p>Nemáte zapsány žádné předměty.</p>', table('')]) {
      serve(page(body));
      const result = await fetchDualLanguageSubjects('1', '2');
      expect(result!.subjects.data).toEqual({});
    }
    expect(notUnderstoodCalls()).toHaveLength(0);
  });
});
