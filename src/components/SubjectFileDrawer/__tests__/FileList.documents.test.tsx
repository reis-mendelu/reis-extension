import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileList } from '../FileList';
import type { FileGroup } from '../types';
import type { ParsedFile } from '../../../types/documents';

vi.mock('../../../hooks/data/useDocumentNoteKeys', () => ({
  useDocumentNoteKeys: () => ({ noteKeys: new Set<string>() }),
}));

const dl = (id: number) => `https://is.mendelu.cz/auth/dok_server/slozka.pl?download=${id};id=1`;

const doc = (over: Partial<ParsedFile>): ParsedFile => ({
  subfolder: '',
  file_name: 'x',
  file_comment: '',
  author: 'J. Novák',
  date: '07.10.2026',
  files: [],
  ...over,
});

/** A lecture row with three PDFs and a lone lecture, the shapes IS really serves. */
const LECTURES = doc({
  file_name: 'ig-03  ig-04  ig-05',
  title: 'ig-03 + ig-04 + ig-05',
  date: '07.10.2026',
  modified: '15.10.2026',
  files: [
    { name: 'x', type: 'pdf', link: dl(1), filename: 'ig-03-fyzicka_vrstva.pdf' },
    { name: 'x', type: 'pdf', link: dl(2), filename: 'eth_frame.pdf' },
    { name: 'x', type: 'pdf', link: dl(3), filename: 'ig-04-Ethernet.pdf' },
  ],
});
const LONE = doc({
  file_name: 'Harmonogramorganizacni informace',
  title: 'Harmonogram+organizacni informace',
  author: 'P. Svoboda',
  date: '17.09.2026',
  files: [{ name: 'x', type: 'pdf', link: dl(4), filename: 'harm.pdf' }],
});

function renderList(files: ParsedFile[], over: Record<string, unknown> = {}) {
  const groups: FileGroup[] = [{ name: 'Ostatní', displayName: 'Ostatní', files }];
  const props = {
    groups,
    selectedIds: [],
    courseCode: 'EBC-PS',
    fileRefs: { current: new Map() },
    ignoreClickRef: { current: false },
    onToggleSelect: vi.fn(),
    onOpenFile: vi.fn(),
    onViewPdf: vi.fn(),
    ...over,
  };
  render(<FileList {...(props as unknown as Parameters<typeof FileList>[0])} />);
  return props;
}

describe('FileList: a document with several files', () => {
  it('names each file by its own name, and the document once above them', () => {
    renderList([LECTURES]);
    // By title: a file name is split by <wbr> and its glued extension.
    expect(screen.getByTitle('ig-03-fyzicka_vrstva.pdf')).toHaveTextContent(
      'ig-03-fyzicka_vrstva.pdf'
    );
    expect(screen.getByTitle('eth_frame.pdf')).toHaveTextContent('eth_frame.pdf');
    expect(screen.getByTitle('ig-04-Ethernet.pdf')).toHaveTextContent('ig-04-Ethernet.pdf');
    expect(screen.getAllByText('ig-03 + ig-04 + ig-05')).toHaveLength(1);
    expect(screen.queryByText(/\(\d\)$/)).toBeNull();
  });

  it('hands the reader the file name it shows, and the date of the last change', async () => {
    // The iPad reader keeps a copy only while this date matches: a replaced
    // file has to reach it with its Modifikace, or the old pages stay.
    const props = renderList([LECTURES]);
    await userEvent.click(screen.getByTitle('eth_frame.pdf'));
    expect(props.onViewPdf).toHaveBeenCalledWith(dl(2), {
      name: 'eth_frame.pdf',
      date: '15.10.2026',
    });
  });
});

describe('FileList: long names', () => {
  /**
   * A one-line truncate cut the extension first ("ig-c04-fyzicka_vrstva.p…").
   * Names wrap to two lines now. The middle cut that keeps the extension needs
   * layout, so it is measured in the browser (verify-ui), not here; the cut
   * itself is unit-tested in documentLabels.test.ts.
   */

  it('wraps a name to two lines instead of cutting it on one', () => {
    renderList([LECTURES]);
    const name = screen.getByTitle('ig-03-fyzicka_vrstva.pdf');
    expect(name.className).toContain('line-clamp-2');
    expect(name.className).not.toContain('truncate');
  });

  it('breaks after separators, and never inside the extension', () => {
    // break-all split "ig-PPS-org-inf-ZS2026.pdf" into "…ZS2026.p" / "df".
    renderList([LECTURES]);
    const name = screen.getByTitle('ig-03-fyzicka_vrstva.pdf');
    expect(name.className).not.toContain('break-all');
    // After "ig-", "03-" and "fyzicka_", the last one before the glued "vrstva.pdf".
    expect(name.querySelectorAll('wbr')).toHaveLength(3);
    const tail = name.querySelector('.whitespace-nowrap');
    expect(tail?.textContent).toBe('vrstva.pdf');
  });

  it('breaks a title between words, not inside them', () => {
    renderList([LONE]);
    expect(screen.getByText('Harmonogram+organizacni informace').className).toContain(
      'break-words'
    );
  });

  it('keeps the whole name on hover', () => {
    renderList([LECTURES]);
    expect(screen.getByTitle('eth_frame.pdf')).toHaveTextContent('eth_frame.pdf');
  });
});

describe('FileList: a document with one file', () => {
  it('goes by its title as IS prints it, with nothing stripped', () => {
    renderList([LONE]);
    expect(screen.getByText('Harmonogram+organizacni informace')).toBeInTheDocument();
  });

  it('shows the document date, not the reader date', () => {
    renderList([{ ...LONE, modified: '23.10.2026' }]);
    expect(screen.getByText('17.09.2026')).toBeInTheDocument();
    expect(screen.queryByText('23.10.2026')).toBeNull();
  });

  it("gives IS's comment its own line, so the author cannot crowd it out on a phone", () => {
    renderList([{ ...LONE, file_comment: 'Cvičení 4 rozvrhovaná na sudý týd...' }]);
    const comment = screen.getByText('Cvičení 4 rozvrhovaná na sudý týd...');
    expect(comment.parentElement).not.toBe(screen.getByText('P. Svoboda').parentElement);
    expect(comment.className).toContain('line-clamp-2');
  });

  it('says who put it there', () => {
    renderList([LONE]);
    expect(screen.getByText('P. Svoboda')).toBeInTheDocument();
  });
});

describe('FileList: "Nový"', () => {
  const visited = new Date(2026, 9, 10).getTime(); // 10.10.2026

  it('marks a document the teacher changed since the last visit, though its date is older', () => {
    renderList([LECTURES], { lastVisitedAt: visited });
    expect(screen.getAllByText('NOVÉ')).toHaveLength(1);
  });

  it('leaves a document alone that has not changed since', () => {
    renderList([LONE], { lastVisitedAt: visited });
    expect(screen.queryByText('NOVÉ')).toBeNull();
  });

  it('reads English dates as well', () => {
    renderList([doc({ ...LONE, date: '09/17/2026', modified: '10/23/2026' })], {
      lastVisitedAt: visited,
    });
    expect(screen.getAllByText('NOVÉ')).toHaveLength(1);
  });
});
