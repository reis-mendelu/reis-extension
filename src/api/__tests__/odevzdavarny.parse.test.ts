import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('../client', () => ({
  BASE_URL: 'https://is.mendelu.cz',
  fetchWithAuth: vi.fn(),
}));
vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

import { fetchOdevzdavarny } from '../odevzdavarny';
import { fetchWithAuth } from '../client';

// Real odevzdavarny.pl pages (trimmed, ids scrubbed), one student, three periods:
//  829 = ZS 2026/27 in week 3 — two open boxes, nothing uploaded yet
//  812 = LS 2025/26 after the exams — five boxes with uploads, 26 closed ones
//  801 = ZS 2025/26 — one closed box
const fixture = (name: string) =>
  readFileSync(join(__dirname, 'fixtures', 'odevzdavarny', name), 'utf-8');

const respond = (body: string) => ({ ok: true, status: 200, text: async () => body }) as Response;

function serve(obdobi: string) {
  const cz = fixture(`obdobi-${obdobi}.cz.html`);
  const en = fixture(`obdobi-${obdobi}.en.html`);
  vi.mocked(fetchWithAuth).mockImplementation(async (url: string) => {
    return respond(url.includes('lang=en') ? en : cz);
  });
}

const count = (rows: { section?: string }[], section: string) =>
  rows.filter((r) => r.section === section).length;

describe('fetchOdevzdavarny — all three IS tables', () => {
  beforeEach(() => {
    vi.mocked(fetchWithAuth).mockReset();
  });

  it('reads the open table: deadline, no uploads, a link to upload', async () => {
    serve('829');
    const result = await fetchOdevzdavarny('100001', '829');
    const rows = result!.assignments;
    expect(rows).toHaveLength(2);
    expect(count(rows, 'open')).toBe(2);
    expect(rows[0]!).toMatchObject({
      section: 'open',
      isOpen: true,
      courseId: '164077',
      courseCode: 'EBC-PJ',
      courseNameCs: 'Programovací jazyk Java',
      courseNameEn: 'Java Programming Language',
      name: 'Rozpracovaný projekt',
      deadline: '08.11.2026 23:59',
      odevzdavarnaId: '65366',
      fileCount: 0,
    });
    expect(rows[0]!.uploadUrl).toContain('odevzdavarny_odevzdani.pl');
    expect(rows[0]!.uploadUrl).toContain('odevzdavarna=65366');
  });

  it('keeps a box after the upload — IS moves it to the submitted table', async () => {
    serve('812');
    const rows = (await fetchOdevzdavarny('100001', '812'))!.assignments;
    expect(count(rows, 'open')).toBe(0);
    expect(count(rows, 'submitted')).toBe(5);
    expect(count(rows, 'closed')).toBe(26);

    const project = rows.find((r) => r.name === '2. projekt')!;
    expect(project).toMatchObject({
      section: 'submitted',
      isOpen: false,
      courseCode: 'EBC-DSND',
      fileCount: 2,
      points: '42',
      // Czech date even though the English page prints 04/26/2026.
      deadline: '26.04.2026 23:59',
    });
    expect(project.odevzdavarnaId).toMatch(/^\d+$/);
    expect(project.uploadUrl).toContain(`odevzdavarna=${project.odevzdavarnaId}`);
  });

  it('marks a submitted box with no points as having none, not zero', async () => {
    serve('812');
    const rows = (await fetchOdevzdavarny('100001', '812'))!.assignments;
    const exam = rows.find((r) => r.name === 'Zkouška DSND 29. 05.')!;
    expect(exam.section).toBe('submitted');
    expect(exam.points).toBeUndefined();
    expect(exam.fileCount).toBe(1);
  });

  it('reads closed boxes, which have no box id, and links them to the period list', async () => {
    serve('812');
    const rows = (await fetchOdevzdavarny('100001', '812'))!.assignments;
    const closed = rows.filter((r) => r.section === 'closed');
    expect(closed.every((r) => r.isOpen === false && r.fileCount === 0)).toBe(true);
    expect(closed[0]!).toMatchObject({
      name: 'Dobrovolná domácí úloha 1',
      deadline: '22.02.2026 21:00',
      odevzdavarnaId: '',
    });
    expect(closed[0]!.uploadUrl).toBe(
      'https://is.mendelu.cz/auth/student/odevzdavarny.pl?studium=100001;obdobi=812'
    );
  });

  it('strips the non-breaking spaces IS puts inside course names', async () => {
    serve('812');
    const rows = (await fetchOdevzdavarny('100001', '812'))!.assignments;
    const dsnd = rows.find((r) => r.courseCode === 'EBC-DSND')!;
    expect(dsnd.courseNameCs).toBe('Databázové systémy a návrh databází');
    expect(dsnd.courseNameEn).toBe('Database Systems and Database Design');
  });

  it('gives every row the same identity in both languages', async () => {
    serve('801');
    const rows = (await fetchOdevzdavarny('100001', '801'))!.assignments;
    expect(rows).toHaveLength(1);
    expect(rows[0]!).toMatchObject({ section: 'closed', courseCode: 'EBC-KOM' });
    expect(rows[0]!.courseNameEn).not.toBe('');
  });

  it('lists the student’s periods in IS order, and tags each row with its own', async () => {
    serve('829');
    const result = (await fetchOdevzdavarny('100001', '829'))!;
    // The page's own <select name="obdobi">, oldest first — the sync takes the
    // period before the current one from here.
    expect(result.periods).toEqual(['801', '812', '829']);
    expect(result.assignments.every((r) => r.obdobi === '829')).toBe(true);
  });

  it('answers null — not an empty list — for a page without the three sections', async () => {
    // A login page or an error page arrives as 200 HTML too. An empty list now
    // overwrites the cache, so mistaking this for "no boxes" would wipe it.
    vi.mocked(fetchWithAuth).mockImplementation(async () =>
      respond('<html><body><form action="/system/login.pl"></form></body></html>')
    );
    expect(await fetchOdevzdavarny('100001', '829')).toBeNull();
  });

  it('answers null when IS adds a column, instead of reading the wrong cells', async () => {
    const drifted = (html: string) =>
      html.replace(/(<th[^>]*>)(Vypsáno pro|Announced for)/, '<th>Nový sloupec</th>$1$2');
    const cz = drifted(fixture('obdobi-829.cz.html'));
    const en = drifted(fixture('obdobi-829.en.html'));
    vi.mocked(fetchWithAuth).mockImplementation(async (url: string) =>
      respond(url.includes('lang=en') ? en : cz)
    );
    expect(await fetchOdevzdavarny('100001', '829')).toBeNull();
  });
});
