import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { pull } from '../../screens/__tests__/pullTestSetup';
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

/**
 * Pull the Files tab down to look for new uploads. It refreshes this subject's
 * files and nothing else — the same `refreshFilesForSubject` the extension's
 * refresh button calls, so what the pull keeps and adds is that action's rule.
 */
describe('pulling a subject’s Files tab', () => {
  const refresh = vi.fn(async () => {});
  beforeEach(() => {
    refresh.mockClear();
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
      subjects: { version: 1, lastUpdated: '', data: { ALG } },
      schedule: { data: [], status: 'success' },
      files: { ALG: [] },
      filesLoading: {},
      lastFilesFetchedAt: { ALG: Date.now() },
      refreshFilesForSubject: refresh,
    } as never);
  });

  it('refreshes this subject’s files', () => {
    renderSheet();
    pull(screen.getByTestId('subject-drawer-scroller'));
    expect(refresh).toHaveBeenCalledWith('ALG');
  });

  it('does not start a second refresh while one is running, and shows it spinning', () => {
    useAppStore.setState({ files: { ALG: [SYLLABUS] }, filesLoading: { ALG: true } } as never);
    renderSheet();
    pull(screen.getByTestId('subject-drawer-scroller'));
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('pull-refresh-indicator').dataset.state).toBe('refreshing');
  });

  // With nothing on screen yet, the skeleton and its "Načítání souborů…" bar
  // already say "loading". A spinner over them said it a third time, and held
  // the skeleton 44px down for no list to reveal.
  it('does not spin over the skeleton', () => {
    useAppStore.setState({ files: { ALG: undefined }, filesLoading: { ALG: true } } as never);
    renderSheet();
    expect(screen.getByTestId('pull-refresh-indicator').dataset.state).toBeUndefined();
    expect(screen.getByText('Načítání souborů...')).toBeInTheDocument();
  });

  it('can be pulled when the tab is empty — the case a student pulls to check', () => {
    renderSheet();
    const scroller = screen.getByTestId('subject-drawer-scroller');
    expect((scroller.firstElementChild as HTMLElement).className).toContain(
      'min-h-[calc(100%+1px)]'
    );
  });

  // The same fix the calendar and exams got (#399): the top of the screen —
  // header, teachers, tab bar — is where a thumb lands, and it was dead.
  it('pulls from the header and the tab bar above the list too', () => {
    renderSheet();
    pull(screen.getByText('Algoritmizace'));
    expect(refresh).toHaveBeenCalledTimes(1);
    pull(screen.getAllByRole('button').find((b) => b.textContent.includes('Soubory'))!);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not pull from the header once the list is scrolled down', () => {
    renderSheet();
    screen.getByTestId('subject-drawer-scroller').scrollTop = 200;
    pull(screen.getByText('Algoritmizace'));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('is the Files tab’s gesture only', () => {
    renderSheet();
    const statsTab = screen.getAllByRole('button').find((b) => b.textContent.includes('Úspěšnost'));
    fireEvent.click(statsTab!);
    expect(screen.queryByTestId('pull-refresh-indicator')).toBeNull();
    pull(screen.getByTestId('subject-drawer-scroller'));
    pull(screen.getByText('Algoritmizace'));
    expect(refresh).not.toHaveBeenCalled();
  });
});
