import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DrawerTabBody } from '../../SubjectFileDrawer/DrawerTabBody';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../SubjectFileDrawer/FileList', () => ({ FileList: () => <div /> }));

const CODE = 'EBC-PS';
const OFFICIAL = 'https://reisapp.cz/navody/predmety?z=app&utm_source=reis-app#oficialne';

function renderFiles(showIsBacklink: boolean) {
  return render(
    <DrawerTabBody
      tab="files"
      lesson={{ courseCode: CODE, courseName: 'Počítačové sítě', courseId: '', id: 'sel-1' }}
      files={[]}
      isFilesLoading={false}
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
      showIsBacklink={showIsBacklink}
    />
  );
}

/**
 * The shared file tab, on both trees (the phone passes showIsBacklink=false):
 * no files, or no answer from IS, offers the subjects guide's official way.
 */
describe('subject files — Jiný postup', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', filesError: {} }));
  afterEach(cleanup);

  it.each([true, false])('links it from an empty folder (IS backlink %s)', (backlink) => {
    renderFiles(backlink);
    expect(screen.getByRole('link', { name: 'Jiný postup' })).toHaveAttribute('href', OFFICIAL);
  });

  it.each([true, false])('links it when the folder failed to load (IS backlink %s)', (backlink) => {
    useAppStore.setState({ filesError: { [CODE]: true }, refreshFilesForSubject: vi.fn() });
    renderFiles(backlink);
    expect(screen.getByTestId('files-error')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jiný postup' })).toHaveAttribute('href', OFFICIAL);
  });
});
