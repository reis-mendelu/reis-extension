import { describe, it, expect, afterEach, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { DrawerTabBody } from '../DrawerTabBody';
import { useAppStore } from '../../../store/useAppStore';
import type { SelectedSubject } from '../../../types/app';
import type { ParsedFile } from '../../../types/documents';
import cs from '../../../i18n/locales/cs.json';

/**
 * Návrhy #26, the Files half. DrawerTabBody is the one body both drawers
 * render — the desktop SubjectFileDrawer and the phone/iPad SubjectDrawerSheet —
 * so this is the parity point: one failed state, on both trees.
 */

vi.mock('../FileList', () => ({
  FileList: () => <div data-testid="file-list" />,
  FileListSkeleton: () => <div data-testid="file-list-skeleton" />,
}));

afterEach(cleanup);

const CODE = 'EBC-PS';
const lesson: SelectedSubject = {
  courseCode: CODE,
  courseName: 'Počítačové sítě',
  courseId: '',
  id: 'sel-1',
};

function renderFiles(over: { files?: ParsedFile[] | null; isSyncing?: boolean } = {}) {
  return render(
    <DrawerTabBody
      tab="files"
      lesson={lesson}
      files={over.files ?? []}
      isFilesLoading={false}
      isSyncing={over.isSyncing ?? false}
      isDragging={false}
      selectionBoxStyle={null}
      showDragHint={false}
      groupedFiles={[]}
      selectedIds={[]}
      fileRefs={{ current: new Map() }}
      ignoreClickRef={{ current: false }}
      toggleSelect={vi.fn()}
      openFile={vi.fn()}
      resolvedCourseId=""
      syllabusResult={{ syllabus: null, isLoading: false }}
    />
  );
}

describe('DrawerTabBody — a failed folder fetch', () => {
  let refresh: Mock<(code: string) => Promise<void>>;

  beforeEach(() => {
    refresh = vi.fn<(code: string) => Promise<void>>(async () => undefined);
    useAppStore.setState({ filesError: { [CODE]: true }, refreshFilesForSubject: refresh });
  });

  it('says it could not load, not that the subject has no files', () => {
    renderFiles();

    // Announced: it can replace the tab's content with no click preceding it.
    expect(screen.getByRole('alert')).toBeInTheDocument();

    expect(screen.getByText(cs.mobile.loadFailed.title)).toBeInTheDocument();
    expect(screen.queryByText(cs.course.footer.noFilesAvailable)).toBeNull();
  });

  it('retries this subject only — not a whole sync', () => {
    renderFiles();
    fireEvent.click(screen.getByRole('button', { name: cs.mobile.loadFailed.retry }));

    expect(refresh).toHaveBeenCalledWith(CODE);
  });

  it('still says so while a background sync runs', () => {
    renderFiles({ isSyncing: true });
    expect(screen.getByText(cs.mobile.loadFailed.title)).toBeInTheDocument();
  });

  it('shows cached files over the failure', () => {
    const cached = [{ file_name: 'a.pdf' } as ParsedFile];
    renderFiles({ files: cached });

    expect(screen.getByTestId('file-list')).toBeInTheDocument();
    expect(screen.queryByText(cs.mobile.loadFailed.title)).toBeNull();
  });

  it('keeps the empty state for a folder that answered empty', () => {
    useAppStore.setState({ filesError: {} });
    renderFiles();

    expect(screen.getByText(cs.course.footer.noFilesAvailable)).toBeInTheDocument();
    expect(screen.queryByText(cs.mobile.loadFailed.title)).toBeNull();
  });
});
