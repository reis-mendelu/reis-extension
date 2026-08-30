import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { SubjectInfo } from '../../../../types/documents';

// Hoisted so the vi.mock factory below can close over the same spies the tests
// assert on — vi.mock is lifted above every other statement in the file.
const fileActions = vi.hoisted(() => ({
  openFile: vi.fn(),
  openPdfInline: vi.fn(),
  downloadSingle: vi.fn(),
}));

vi.mock('../../../../hooks/ui/useFileActions', () => ({
  useFileActions: () => ({
    isDownloading: false,
    downloadProgress: null,
    openFile: fileActions.openFile,
    openPdfInline: fileActions.openPdfInline,
    downloadSingle: fileActions.downloadSingle,
    downloadZip: vi.fn(),
  }),
}));

// The real viewer pulls in pdf.js and a worker; this sheet's contract is that it
// mounts one over the drawer with the blob URL, which is what is asserted here.
vi.mock('../../../SubjectFileDrawer/PdfViewer', () => ({
  PdfViewer: ({ blobUrl, onClose }: { blobUrl: string; onClose: () => void }) => (
    <div data-testid="mobile-pdf-preview" data-blob={blobUrl}>
      <button onClick={onClose}>close-preview</button>
    </div>
  ),
}));

describe('SubjectDrawerSheet', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: { version: 1, lastUpdated: '', data: {} },
      schedule: { data: [], status: 'success' },
    } as never);
  });

  it('opens on the files tab when the subject has a subjectId (enrolled)', () => {
    const enrolledSubject: SubjectInfo = {
      displayName: 'ALG',
      fullName: 'Algoritmizace',
      subjectCode: 'ALG',
      subjectId: '159410', // Present = enrolled
      folderUrl: 'https://is.mendelu.cz/auth/katalog/predmety.pl?predmet=159410',
      fetchedAt: new Date().toISOString(),
    };

    useAppStore.setState({
      subjects: {
        version: 1,
        lastUpdated: new Date().toISOString(),
        data: { ALG: enrolledSubject },
      },
      files: { ALG: [] },
      lastFilesFetchedAt: { ALG: Date.now() },
    } as never);

    const onClose = vi.fn();
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }}
        onClose={onClose}
      />
    );

    // The files tab should be active (marked with border-primary)
    // Check that the active tab button has the primary border
    const fileButtons = screen.getAllByRole('button');
    const filesButton = fileButtons.find((btn) => btn.textContent.includes('Soubory'));
    expect(filesButton).toHaveClass('border-primary', 'text-primary');

    // The files body should be rendered (not the stats body)
    // FileList renders grouped files; when empty, it shows the empty state with FileText icon
    expect(screen.getByText('Žádné soubory nejsou k dispozici.')).toBeInTheDocument();
  });

  it('opens on the stats tab when the subject has no subjectId (not enrolled)', () => {
    const unenrolledSubject: SubjectInfo = {
      displayName: 'BIO',
      fullName: 'Biologie',
      subjectCode: 'BIO',
      // No subjectId = not enrolled
      folderUrl: 'https://is.mendelu.cz/auth/katalog/predmety.pl',
      fetchedAt: new Date().toISOString(),
    };

    useAppStore.setState({
      subjects: {
        version: 1,
        lastUpdated: new Date().toISOString(),
        data: { BIO: unenrolledSubject },
      },
    } as never);

    const onClose = vi.fn();
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'BIO', courseName: 'Biologie' }}
        onClose={onClose}
      />
    );

    // The stats tab should be active (marked with border-primary)
    const fileButtons = screen.getAllByRole('button');
    const statsButton = fileButtons.find((btn) => btn.textContent.includes('Úspěšnost'));
    expect(statsButton).toHaveClass('border-primary', 'text-primary');

    // The files body should NOT be rendered; the files empty state message should not appear
    expect(screen.queryByText('Žádné soubory nejsou k dispozici.')).not.toBeInTheDocument();
  });
});

/**
 * The drawer is a whole screen, not a sheet. It already filled all but 70px of
 * the viewport, so the dimmed strip above it and the slide-up entrance were
 * advertising a temporary overlay you could look past — for what is really a
 * destination you navigate into and come back from.
 */
describe('SubjectDrawerSheet presentation', () => {
  const renderDrawer = (onClose = vi.fn()) =>
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'BIO', courseName: 'Biologie' }}
        onClose={onClose}
      />
    );

  it('presents as a full-bleed screen with no backdrop behind it', () => {
    renderDrawer();
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument();
    expect(screen.getByTestId('sheet-panel').className).toContain('inset-0');
  });

  it('offers back rather than close, since back is how a screen is left', () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    expect(screen.queryByLabelText('Zavřít')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Zpět'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * The Android back button pops the same sheet stack, so the chevron and the
   * system gesture are the same code path — this is what keeps them in step.
   */
  it('leaves via the same onClose the back button pops the stack with', () => {
    const onClose = vi.fn();
    renderDrawer(onClose);
    fireEvent.click(screen.getByLabelText('Zpět'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/**
 * Sprint 08, iPad: tapping a file went straight to a download (the iOS share
 * sheet) with no way to just look at it first. The desktop drawer has wired
 * `onViewPdf` to the inline viewer since it was built; this sheet passed only
 * `openFile`, so the row's PDF branch could never fire.
 */
describe('SubjectDrawerSheet — previewing a file before downloading it', () => {
  beforeEach(() => {
    fileActions.openPdfInline.mockReset().mockResolvedValue('blob:preview');
    fileActions.openFile.mockReset();
    fileActions.downloadSingle.mockReset();
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: {
        version: 1,
        lastUpdated: '',
        data: {
          ALG: {
            displayName: 'ALG',
            fullName: 'Algoritmizace',
            subjectCode: 'ALG',
            subjectId: '159410',
            folderUrl: 'https://is.mendelu.cz/auth/katalog/predmety.pl?predmet=159410',
            fetchedAt: new Date().toISOString(),
          },
        },
      },
      files: {
        ALG: [
          {
            subfolder: 'Přednášky',
            file_name: 'Prednaska01.pdf',
            file_comment: '',
            author: 'Jan Novák',
            date: '01. 01. 2026',
            files: [
              {
                name: 'Prednaska01.pdf',
                type: 'pdf',
                link: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?f=1',
              },
            ],
          },
          {
            subfolder: 'Přednášky',
            file_name: 'Data.xlsx',
            file_comment: '',
            author: 'Jan Novák',
            date: '01. 01. 2026',
            files: [
              {
                name: 'Data.xlsx',
                type: 'xlsx',
                link: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?f=2',
              },
            ],
          },
        ],
      },
      lastFilesFetchedAt: { ALG: Date.now() },
      schedule: { data: [], status: 'success' },
    } as never);
  });

  const renderSheet = () =>
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }}
        onClose={vi.fn()}
      />
    );

  it('previews a PDF row instead of downloading it', async () => {
    renderSheet();
    fireEvent.click(screen.getByText('Prednaska01.pdf'));
    await waitFor(() =>
      expect(fileActions.openPdfInline).toHaveBeenCalledWith(expect.stringContaining('f=1'))
    );
    expect(fileActions.openFile).not.toHaveBeenCalled();
  });

  it('shows the previewed PDF over the drawer', async () => {
    renderSheet();
    fireEvent.click(screen.getByText('Prednaska01.pdf'));
    expect(await screen.findByTestId('mobile-pdf-preview')).toBeInTheDocument();
  });

  it('still downloads a file it cannot preview', () => {
    renderSheet();
    fireEvent.click(screen.getByText('Data.xlsx'));
    expect(fileActions.openFile).toHaveBeenCalledWith(expect.stringContaining('f=2'));
    expect(fileActions.openPdfInline).not.toHaveBeenCalled();
  });

  it('keeps the download action reachable from the previewed row', () => {
    renderSheet();
    // "Preview, then download": preview is the tap, saving stays one deliberate
    // press away on the row's own download button.
    // Rows sort by name, so scope to the PDF's own row rather than trusting an
    // index — Data.xlsx sorts first.
    const pdfRow = screen.getByText('Prednaska01.pdf').closest('.space-y-1') as HTMLElement;
    fireEvent.click(within(pdfRow).getByTitle('Stáhnout'));
    expect(fileActions.downloadSingle).toHaveBeenCalledWith(expect.stringContaining('f=1'));
    expect(fileActions.openPdfInline).not.toHaveBeenCalled();
  });

  it('falls back to a download when the file turns out not to be a real PDF', async () => {
    fileActions.openPdfInline.mockResolvedValue(null);
    renderSheet();
    fireEvent.click(screen.getByText('Prednaska01.pdf'));
    await waitFor(() =>
      expect(fileActions.openFile).toHaveBeenCalledWith(expect.stringContaining('f=1'))
    );
  });
});
