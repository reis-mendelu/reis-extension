import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import type { ParsedFile, SubjectInfo } from '../../../../types/documents';

vi.mock('../../../../hooks/ui/useFileActions', () => ({
  useFileActions: () => ({
    isDownloading: false,
    downloadProgress: null,
    openFile: vi.fn(),
    openPdfInline: vi.fn(),
    downloadSingle: vi.fn(),
    downloadZip: vi.fn(),
  }),
}));
vi.mock('../../../SubjectFileDrawer/PdfViewer', () => ({ PdfViewer: () => null }));

const ALG: SubjectInfo = {
  displayName: 'ALG',
  fullName: 'Algoritmizace',
  subjectCode: 'ALG',
  subjectId: '159410',
  folderUrl: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=1',
  fetchedAt: '',
};

const SYLLABUS: ParsedFile = {
  subfolder: '',
  file_name: 'Sylabus',
  file_comment: '',
  author: '',
  date: '01.09.2026',
  files: [{ name: 'Sylabus', type: 'pdf', link: 'https://is.mendelu.cz/x?download=1;id=1' }],
};

const renderSheet = () =>
  render(
    <SubjectDrawerSheet
      sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }}
      onClose={vi.fn()}
    />
  );

const refreshButton = () => screen.queryByRole('button', { name: 'Obnovit soubory' });

/**
 * The Files tab's refresh for whoever cannot pull — the same answer the
 * calendar and exams got (RefreshButton). The iPad app on a Mac reports
 * `pointer: fine`, and neither a mouse drag nor a trackpad scroll makes the
 * touch pull, so without this a Mac student could not look for a file the
 * teacher just uploaded. Same action as the pull and as the extension's
 * FilesFreshness circle: `refreshFilesForSubject`.
 */
describe('a subject’s Files tab without a pull', () => {
  const refresh = vi.fn(async () => {});
  beforeEach(() => {
    refresh.mockClear();
    useAppStore.setState({
      language: 'cz',
      isTouch: false,
      mobileSheets: [],
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: { version: 1, lastUpdated: '', data: { ALG } },
      schedule: { data: [], status: 'success' },
      files: { ALG: [SYLLABUS] },
      filesLoading: {},
      lastFilesFetchedAt: { ALG: Date.now() },
      refreshFilesForSubject: refresh,
    } as never);
  });

  it('has a visible refresh circle on a Mac that refreshes this subject’s files', () => {
    renderSheet();
    const button = refreshButton()!;
    expect(button.className).not.toContain('sr-only');
    fireEvent.click(button);
    expect(refresh).toHaveBeenCalledWith('ALG');
  });

  it('cannot start a second refresh while one runs', () => {
    useAppStore.setState({ filesLoading: { ALG: true } } as never);
    renderSheet();
    expect(refreshButton()).toBeDisabled();
  });

  it('is the Files tab’s only, like the pull', () => {
    renderSheet();
    const statsTab = screen.getAllByRole('button').find((b) => b.textContent.includes('Úspěšnost'));
    fireEvent.click(statsTab!);
    expect(refreshButton()).toBeNull();
  });

  it('takes no layout on a touch screen, where the pull is the visible route', () => {
    useAppStore.setState({ isTouch: true } as never);
    renderSheet();
    expect(refreshButton()!.className).toContain('sr-only');
  });
});
