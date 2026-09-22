import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileList } from '../FileList';
import type { FileGroup } from '../types';

vi.mock('../../../hooks/data/useDocumentNoteKeys', () => ({
  useDocumentNoteKeys: () => ({ noteKeys: new Set<string>() }),
}));

const VIEWER =
  'https://is.mendelu.cz/auth/dok_server/dokumenty_cteni.pl?id=1;dok=359057;serializace=x';
const DOWNLOAD = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=359057;id=1';

function groups(files: FileGroup['files']): FileGroup[] {
  return [{ name: 'materials', displayName: 'Materiály', files }];
}

function renderList(over: Partial<Parameters<typeof FileList>[0]> = {}) {
  const props = {
    groups: groups([
      {
        file_name: 'Přednáška 09',
        date: '12. 3. 2026',
        files: [
          { name: 'Přednáška 09', type: 'unknown', link: VIEWER },
          { name: 'Přednáška 09', type: 'pdf', link: DOWNLOAD },
        ],
      },
    ] as unknown as FileGroup['files']),
    selectedIds: [],
    courseCode: 'EBC-MT',
    fileRefs: createRef() as never,
    ignoreClickRef: { current: false },
    onToggleSelect: vi.fn(),
    onOpenFile: vi.fn(),
    ...over,
  };
  // fileRefs is a live Map ref in the real drawer.
  props.fileRefs = { current: new Map() } as never;
  return { props, ...render(<FileList {...(props as Parameters<typeof FileList>[0])} />) };
}

describe('FileList folder headers', () => {
  /**
   * A subject's files are split by the folders the teacher made in IS —
   * "Kombinovaná forma studia" holds "Blok 1", "Přednášky" holds the lectures.
   * The folder name was `text-base-content/50` uppercase, the faintest text in
   * the drawer, so a file like "Blok 1" read as though it belonged to nothing:
   * "skoro nevýrazné".
   */
  it('names each folder as a heading, not as faint caption text', () => {
    renderList();
    const heading = screen.getByRole('heading', { name: /Materiály/ });
    expect(heading.className).not.toContain('text-base-content/50');
    expect(heading.className).not.toContain('uppercase');
  });

  it('says how many documents the folder holds', () => {
    renderList();
    const heading = screen.getByRole('heading', { name: /Materiály/ });
    expect(within(heading).getByText('1')).toBeInTheDocument();
  });
});

describe('FileList download feedback', () => {
  it('turns the download button into a spinner while that file comes down', () => {
    renderList({ onDownloadSingle: vi.fn(), downloadingLink: DOWNLOAD });
    const button = screen.getByRole('button', { name: /Stáhnout|Download/ });
    expect(button).toBeDisabled();
    expect(within(button).getByTestId('file-download-spinner')).toBeInTheDocument();
  });

  /**
   * A spinner in a 24px button was too quiet — "zkus z toho udělat nějaký
   * progress bar, který bude více viditelný". The row itself now says it:
   * a bar along its bottom edge and "Stahuji…" in place of the date. The bar
   * is indeterminate because the phone's native HTTP layer hands the file over
   * in one piece, with no byte count to fill it from.
   */
  it('shows a progress bar across the row, and says it is downloading', () => {
    renderList({ onDownloadSingle: vi.fn(), downloadingLink: DOWNLOAD });
    const bar = screen.getByRole('progressbar', { name: 'Stahuji…' });
    expect(bar.className).toContain('progress-primary');
    expect(screen.getByText('Stahuji…')).toBeInTheDocument();
    expect(screen.queryByText('12. 3. 2026')).not.toBeInTheDocument();
  });

  it('leaves the other rows alone', () => {
    renderList({ onDownloadSingle: vi.fn(), downloadingLink: 'https://is.mendelu.cz/other' });
    const button = screen.getByRole('button', { name: /Stáhnout|Download/ });
    expect(button).not.toBeDisabled();
    expect(screen.queryByTestId('file-download-spinner')).not.toBeInTheDocument();
  });
});

describe('FileList', () => {
  it('renders one row per document, not one per IS link', () => {
    renderList();
    expect(screen.getAllByText('Přednáška 09')).toHaveLength(1);
    // The "(1)" / "(2)" suffixes are what the duplicate rows used to look like.
    expect(screen.queryByText('Přednáška 09 (1)')).toBeNull();
  });

  it('opens the DIRECT DOWNLOAD link, never the old-IS viewer page', async () => {
    const onOpenFile = vi.fn();
    renderList({ onOpenFile });
    await userEvent.click(screen.getByText('Přednáška 09'));
    expect(onOpenFile).toHaveBeenCalledWith(DOWNLOAD);
  });

  it('hands the row name and IS document date along with a PDF link — the iPad reader caches by date', async () => {
    const onViewPdf = vi.fn();
    renderList({ onViewPdf });
    await userEvent.click(screen.getByText('Přednáška 09'));
    expect(onViewPdf).toHaveBeenCalledWith(DOWNLOAD, { name: 'Přednáška 09', date: '12. 3. 2026' });
  });

  it('opens a row IS gave no type in the reader too — IS labels plenty of PDFs "unknown"', async () => {
    const onViewPdf = vi.fn();
    const onOpenFile = vi.fn();
    renderList({
      onViewPdf,
      onOpenFile,
      groups: groups([
        {
          file_name: 'Skripta',
          date: '01. 2. 2026',
          files: [{ name: 'Skripta', type: 'unknown', link: DOWNLOAD }],
        },
      ] as unknown as FileGroup['files']),
    });

    await userEvent.click(screen.getByText('Skripta'));

    expect(onViewPdf).toHaveBeenCalledWith(DOWNLOAD, { name: 'Skripta', date: '01. 2. 2026' });
    expect(onOpenFile).not.toHaveBeenCalled();
  });

  it('still downloads a row IS says is not a PDF', async () => {
    const onViewPdf = vi.fn();
    const onOpenFile = vi.fn();
    renderList({
      onViewPdf,
      onOpenFile,
      groups: groups([
        {
          file_name: 'Tabulka',
          date: '01. 2. 2026',
          files: [{ name: 'Tabulka', type: 'xlsx', link: DOWNLOAD }],
        },
      ] as unknown as FileGroup['files']),
    });

    await userEvent.click(screen.getByText('Tabulka'));

    expect(onOpenFile).toHaveBeenCalledWith(DOWNLOAD);
    expect(onViewPdf).not.toHaveBeenCalled();
  });

  it('shows the empty state when there is nothing to list', () => {
    renderList({ groups: [] });
    expect(screen.queryByText('Přednáška 09')).toBeNull();
  });

  it('hides the selection checkbox when the host turns selection off', () => {
    const { container } = renderList({ selectable: false });
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it('shows it when selection is on — the desktop bulk-download path', () => {
    const { container } = renderList({ selectable: true });
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  });
});

/**
 * Feedback while a tapped file is being fetched.
 *
 * "While waiting for a file to open there's no loading so it seems the button
 * is not working." The fetch is a whole PDF over the IS session — seconds on
 * campus wifi — and the row did not change in any way for the whole of it,
 * because `usePdfPreview` computed `isPreviewLoading` and no caller ever read
 * it. A second tap then queued a second open.
 */
describe('FileList: the row being opened', () => {
  const OTHER = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=99;id=1';
  /** Two documents, so "this row and not that one" is actually testable. */
  const twoDocs = groups([
    {
      file_name: 'Přednáška 09',
      date: '12. 3. 2026',
      files: [{ name: 'Přednáška 09', type: 'pdf', link: DOWNLOAD }],
    },
    {
      file_name: 'Přednáška 10',
      date: '19. 3. 2026',
      files: [{ name: 'Přednáška 10', type: 'pdf', link: OTHER }],
    },
  ] as unknown as FileGroup['files']);

  it('marks the row whose file is being fetched as busy', () => {
    renderList({ groups: twoDocs, openingLink: DOWNLOAD });
    const row = screen.getByTestId(`file-row-${DOWNLOAD}`);
    expect(row).toHaveAttribute('aria-busy', 'true');
    expect(within(row).getByTestId('file-row-spinner')).toBeInTheDocument();
  });

  it('leaves every other row alone', () => {
    renderList({ groups: twoDocs, openingLink: DOWNLOAD });
    const other = screen.getByTestId(`file-row-${OTHER}`);
    expect(other).not.toHaveAttribute('aria-busy', 'true');
    expect(within(other).queryByTestId('file-row-spinner')).not.toBeInTheDocument();
  });

  it('marks nothing busy when no file is being opened', () => {
    renderList({ groups: twoDocs });
    expect(screen.queryByTestId('file-row-spinner')).not.toBeInTheDocument();
  });

  it('ignores a second tap while the first is still fetching', async () => {
    // The old row gave no sign it was working, so a student tapped again and
    // queued a second open behind the first.
    const onViewPdf = vi.fn();
    renderList({ groups: twoDocs, openingLink: DOWNLOAD, onViewPdf });
    await userEvent.click(screen.getByText('Přednáška 09'));
    expect(onViewPdf).not.toHaveBeenCalled();
  });
});
