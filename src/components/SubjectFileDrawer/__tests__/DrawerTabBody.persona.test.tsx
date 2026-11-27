import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DrawerTabBody } from '../DrawerTabBody';
import { useAppStore } from '../../../store/useAppStore';
import type { SelectedSubject } from '../../../types/app';
import type { ParsedFile } from '../../../types/documents';
import type { DrawerTab } from '../types';
import { setImpersonating } from '../../Impersonation/__tests__/personaTestState';

/**
 * Admin personas, step D. DrawerTabBody is the one body both drawers render
 * (the desktop SubjectFileDrawer and the phone/iPad SubjectDrawerSheet), so
 * this covers both trees. Files and Záznamník are personal in IS: a persona
 * gets neither, and their stores are keyed by subject code, so a subject the
 * persona shares with the admin would show the ADMIN's own marks.
 */

vi.mock('../FileList', () => ({ FileList: () => <div data-testid="file-list" /> }));
vi.mock('../FileListSkeleton', () => ({
  FileListSkeleton: () => <div data-testid="file-list-skeleton" />,
}));

const CODE = 'EBC-PS';
const lesson: SelectedSubject = {
  courseCode: CODE,
  courseName: 'Počítačové sítě',
  courseId: '',
  id: 'sel-1',
};

function renderTab(tab: DrawerTab, over: { files?: ParsedFile[]; loading?: boolean } = {}) {
  return render(
    <DrawerTabBody
      tab={tab}
      lesson={lesson}
      files={over.files ?? []}
      isFilesLoading={over.loading ?? false}
      isSyncing={false}
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

beforeEach(() => {
  setImpersonating(false);
  useAppStore.setState({
    language: 'cz',
    filesError: {},
    studiumId: '123',
    obdobiId: '456',
    zaznamnikHydrated: true,
    zaznamnik: {},
    zaznamnikLoading: {},
    attendance: {},
    odevzdavarny: [],
    subjects: { data: { [CODE]: { hasPrubezne: true, hasTest: true, subjectId: '789' } } },
  } as never);
});
afterEach(cleanup);

describe('Files tab', () => {
  it('shows the persona note instead of "no files" while impersonating', () => {
    setImpersonating(true);
    renderTab('files');
    expect(screen.getByTestId('persona-unavailable')).toHaveTextContent('Soubory');
    expect(screen.queryByText('Žádné soubory nejsou k dispozici.')).not.toBeInTheDocument();
  });

  it('shows the note rather than a skeleton that never resolves', () => {
    setImpersonating(true);
    renderTab('files', { loading: true });
    expect(screen.getByTestId('persona-unavailable')).toBeInTheDocument();
    expect(screen.queryByTestId('file-list-skeleton')).not.toBeInTheDocument();
  });

  it('keeps the normal empty state otherwise', () => {
    renderTab('files');
    expect(screen.queryByTestId('persona-unavailable')).not.toBeInTheDocument();
    expect(screen.getByText('Žádné soubory nejsou k dispozici.')).toBeInTheDocument();
  });
});

describe('Záznamník tab', () => {
  it('shows the persona note instead of the empty state while impersonating', () => {
    setImpersonating(true);
    renderTab('zaznamnik');
    expect(screen.getByTestId('persona-unavailable')).toHaveTextContent('Záznamník');
    expect(screen.queryByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeNull();
  });

  it('never shows the admin’s own marks for a subject the persona shares', () => {
    useAppStore.setState({
      zaznamnik: {
        [CODE]: {
          ph: { sections: [], fetchedAt: 1 },
          vt: {
            tests: [
              {
                name: 'Admin test',
                score: 9,
                maxScore: 10,
                successPct: 90,
                submittedAt: '1.10.2026',
                teacher: 'Učitel',
                hasDetail: false,
              },
            ],
            fetchedAt: 1,
          },
        },
      },
    } as never);
    setImpersonating(true);
    renderTab('zaznamnik');
    expect(screen.getByTestId('persona-unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Admin test')).not.toBeInTheDocument();
  });

  it('keeps the normal empty state otherwise', () => {
    renderTab('zaznamnik');
    expect(screen.queryByTestId('persona-unavailable')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeInTheDocument();
  });
});
