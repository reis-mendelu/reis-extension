import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { pull } from '../../screens/__tests__/pullTestSetup';
import type { SubjectInfo } from '../../../../types/documents';

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
    useAppStore.setState({ filesLoading: { ALG: true } } as never);
    renderSheet();
    pull(screen.getByTestId('subject-drawer-scroller'));
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('pull-refresh-indicator').dataset.state).toBe('refreshing');
  });

  it('can be pulled when the tab is empty — the case a student pulls to check', () => {
    renderSheet();
    const scroller = screen.getByTestId('subject-drawer-scroller');
    expect((scroller.firstElementChild as HTMLElement).className).toContain(
      'min-h-[calc(100%+1px)]'
    );
  });

  it('is the Files tab’s gesture only', () => {
    renderSheet();
    const statsTab = screen.getAllByRole('button').find((b) => b.textContent.includes('Úspěšnost'));
    fireEvent.click(statsTab!);
    expect(screen.queryByTestId('pull-refresh-indicator')).toBeNull();
    pull(screen.getByTestId('subject-drawer-scroller'));
    expect(refresh).not.toHaveBeenCalled();
  });
});
