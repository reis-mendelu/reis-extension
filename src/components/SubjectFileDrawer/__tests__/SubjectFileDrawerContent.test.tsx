import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SubjectFileDrawerContent } from '../SubjectFileDrawerContent';
import { HeaderTabs } from '../Header/HeaderTabs';
import type { FileGroup } from '../types';
import type { SelectedSubject } from '../../../types/app';
import cs from '../../../i18n/locales/cs.json';

vi.mock('../FileList', () => ({
  FileList: (props: { courseCode: string; groups: unknown[] }) => (
    <div
      data-testid="file-list"
      data-course-code={props.courseCode}
      data-groups={props.groups.length}
    />
  ),
  FileListSkeleton: () => <div data-testid="file-list-skeleton" />,
}));

vi.mock('../SyllabusTab', () => ({
  SyllabusTab: (props: { courseCode: string; courseId?: string; courseName?: string }) => (
    <div
      data-testid="syllabus-tab"
      data-course-code={props.courseCode}
      data-course-id={props.courseId}
      data-course-name={props.courseName}
    />
  ),
}));

vi.mock('../ClassmatesTab', () => ({
  ClassmatesTab: (props: { courseCode: string }) => (
    <div data-testid="classmates-tab" data-course-code={props.courseCode} />
  ),
}));

vi.mock('../ZaznamnikTab', () => ({
  ZaznamnikTab: (props: { courseCode: string }) => (
    <div data-testid="zaznamnik-tab" data-course-code={props.courseCode} />
  ),
}));

vi.mock('../../SuccessRateTab', () => ({
  SuccessRateTab: (props: { courseCode: string; facultyCode?: string }) => (
    <div
      data-testid="success-rate-tab"
      data-course-code={props.courseCode}
      data-faculty-code={props.facultyCode}
    />
  ),
}));

afterEach(cleanup);

const groupedFiles: FileGroup[] = [{ name: 'root', displayName: 'root', files: [] }];

const lesson: SelectedSubject = {
  courseCode: 'ABC123',
  courseName: 'Test Course',
  courseId: 'id-1',
  id: 'sel-1',
  facultyCode: 'PEF',
};

function baseProps(overrides: Partial<React.ComponentProps<typeof SubjectFileDrawerContent>> = {}) {
  return {
    activeTab: 'files' as const,
    lesson,
    files: null,
    isFilesLoading: false,
    isSyncing: false,
    isDragging: false,
    selectionBoxStyle: null,
    showDragHint: false,
    groupedFiles,
    selectedIds: [],
    fileRefs: { current: new Map() },
    ignoreClickRef: { current: false },
    toggleSelect: vi.fn(),
    openFile: vi.fn(),
    resolvedCourseId: 'id-1',
    syllabusResult: { syllabus: null, isLoading: false },
    ...overrides,
  };
}

describe('SubjectFileDrawerContent — files tab', () => {
  it('shows the skeleton when files are loading and none are cached yet', () => {
    render(<SubjectFileDrawerContent {...baseProps({ isFilesLoading: true, files: null })} />);
    expect(screen.getByTestId('file-list-skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('file-list')).toBeNull();
  });

  it('shows the empty state when not loading/syncing and there are no files', () => {
    render(
      <SubjectFileDrawerContent
        {...baseProps({
          isFilesLoading: false,
          isSyncing: false,
          files: null,
          folderUrl: 'https://is.mendelu.cz/folder',
        })}
      />
    );
    expect(screen.getByText(cs.course.footer.noFilesAvailable)).toBeInTheDocument();
    expect(screen.queryByTestId('file-list-skeleton')).toBeNull();
    expect(screen.queryByTestId('file-list')).toBeNull();
  });

  it('shows the search-only message instead of the generic empty message when the lesson came from search', () => {
    render(
      <SubjectFileDrawerContent
        {...baseProps({ lesson: { ...lesson, isFromSearch: true }, files: null })}
      />
    );
    expect(screen.getByText(cs.course.footer.searchOnlyInSchedule)).toBeInTheDocument();
  });

  it('renders FileList (not the empty state) once syncing starts, even while files are still empty', () => {
    // Characterizes existing quirk: showProgress suppresses the empty-state branch,
    // so FileList renders (with empty groups) underneath the "loading files" banner.
    render(
      <SubjectFileDrawerContent
        {...baseProps({ isFilesLoading: false, isSyncing: true, files: null })}
      />
    );
    expect(screen.getByText(cs.course.sync.loadingFiles)).toBeInTheDocument();
    expect(screen.getByTestId('file-list')).toBeInTheDocument();
  });

  it('renders FileList with the grouped files once files are present', () => {
    render(
      <SubjectFileDrawerContent
        {...baseProps({
          files: [
            { subfolder: '', file_name: 'a', file_comment: '', author: '', date: '', files: [] },
          ],
        })}
      />
    );
    const list = screen.getByTestId('file-list');
    expect(list).toBeInTheDocument();
    expect(list.getAttribute('data-course-code')).toBe('ABC123');
    expect(list.getAttribute('data-groups')).toBe(String(groupedFiles.length));
  });
});

describe('SubjectFileDrawerContent — tab switching', () => {
  it('renders SyllabusTab for the syllabus tab, passing course identity + prefetched result through', () => {
    render(
      <SubjectFileDrawerContent
        {...baseProps({
          activeTab: 'syllabus',
          syllabusResult: { syllabus: null, isLoading: true },
        })}
      />
    );
    const tab = screen.getByTestId('syllabus-tab');
    expect(tab.getAttribute('data-course-code')).toBe('ABC123');
    expect(tab.getAttribute('data-course-id')).toBe('id-1');
    expect(tab.getAttribute('data-course-name')).toBe('Test Course');
  });

  it('renders ClassmatesTab for the classmates tab', () => {
    render(<SubjectFileDrawerContent {...baseProps({ activeTab: 'classmates' })} />);
    expect(screen.getByTestId('classmates-tab').getAttribute('data-course-code')).toBe('ABC123');
  });

  it('renders ZaznamnikTab for the zaznamnik tab', () => {
    render(<SubjectFileDrawerContent {...baseProps({ activeTab: 'zaznamnik' })} />);
    expect(screen.getByTestId('zaznamnik-tab').getAttribute('data-course-code')).toBe('ABC123');
  });

  it('renders SuccessRateTab for the stats tab, including the faculty code from the lesson', () => {
    render(<SubjectFileDrawerContent {...baseProps({ activeTab: 'stats' })} />);
    const tab = screen.getByTestId('success-rate-tab');
    expect(tab.getAttribute('data-course-code')).toBe('ABC123');
    expect(tab.getAttribute('data-faculty-code')).toBe('PEF');
  });

  it('swaps the rendered body when activeTab changes, unmounting the previous one', () => {
    const { rerender } = render(
      <SubjectFileDrawerContent {...baseProps({ activeTab: 'files' })} />
    );
    expect(screen.queryByTestId('syllabus-tab')).toBeNull();

    rerender(<SubjectFileDrawerContent {...baseProps({ activeTab: 'syllabus' })} />);
    expect(screen.queryByTestId('file-list-skeleton')).toBeNull();
    expect(screen.queryByTestId('file-list')).toBeNull();
    expect(screen.getByTestId('syllabus-tab')).toBeInTheDocument();

    rerender(<SubjectFileDrawerContent {...baseProps({ activeTab: 'classmates' })} />);
    expect(screen.queryByTestId('syllabus-tab')).toBeNull();
    expect(screen.getByTestId('classmates-tab')).toBeInTheDocument();
  });
});

// HeaderTabs is the sibling component that actually renders the tab badges;
// SubjectFileDrawerContent itself has no badge UI. Characterized here
// alongside the tab-body switch since both make up "the drawer's tab
// behaviour" this refactor must not disturb.
describe('HeaderTabs — badge counts', () => {
  it('shows a badge only for tabs with a defined, non-zero count by default', () => {
    render(
      <HeaderTabs
        activeTab="files"
        onTabChange={vi.fn()}
        counts={{ files: 3, classmates: 0, zaznamnik: undefined }}
      />
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('shows a zero badge for tabs explicitly opted into zeroBadgeTabs', () => {
    render(
      <HeaderTabs
        activeTab="files"
        onTabChange={vi.fn()}
        counts={{ zaznamnik: 0 }}
        zeroBadgeTabs={['zaznamnik']}
      />
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders no badge at all when a tab has no count entry', () => {
    render(<HeaderTabs activeTab="files" onTabChange={vi.fn()} counts={{}} />);
    expect(screen.queryByText('0')).toBeNull();
    expect(screen.queryByText('3')).toBeNull();
  });
});
