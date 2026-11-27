import { useEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Sheet } from '../primitives/Sheet';
import { SubjectSheetHeader } from './SubjectSheetHeader';
import { WeekLessonPlace } from './WeekLessonPlace';
import { TeacherList } from './TeacherList';
import { SubjectDrawerTabs } from './SubjectDrawerTabs';
import { stepTab, SUBJECT_TAB_ORDER } from './subjectTabStep';
import { SubjectDrawerScroller } from './SubjectDrawerScroller';
import { SubjectFilesRefreshButton } from './SubjectFilesRefreshButton';
import { SubjectPdfOverlay } from './SubjectPdfOverlay';
import { DrawerTabBody } from '../../SubjectFileDrawer/DrawerTabBody';
import { groupAndSortFiles } from '../../SubjectFileDrawer/utils/groupFiles';
import type { DrawerTab } from '../../SubjectFileDrawer/types';
import type { SelectedSubject } from '../../../types/app';
import type { MobileSheet } from '../../../store/types';
import { useFiles } from '../../../hooks/data/useFiles';
import { useClassmates } from '../../../hooks/data/useClassmates';
import { useZaznamnik } from '../../../hooks/data/useZaznamnik';
import { useOdevzdavarny } from '../../../hooks/data/useOdevzdavarny';
import { useSyllabus } from '../../../hooks/data/useSyllabus';
import { useSubjects } from '../../../hooks/data/useSubjects';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useSyncStatus } from '../../../hooks/data/useSyncStatus';
import { usePdfPreview } from '../../../hooks/ui/usePdfPreview';
import { listSubjectPdfs } from '../../SubjectFileDrawer/utils/listSubjectPdfs';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { useCourseName } from '../../../hooks/ui/useCourseName';
import { useMarkZaznamnikSeen } from '../../../hooks/ui/useMarkZaznamnikSeen';
import { useFileLastVisit } from '../../../hooks/ui/useFileLastVisit';
import { syllabusUrl } from '../../../utils/syllabusUrl';
import { zaznamnikTabCount } from '../../../utils/zaznamnik/tabCount';

type SubjectDrawerSheetData = Extract<MobileSheet, { kind: 'subjectDrawer' }>;

const NO_ID_DISABLED: DrawerTab[] = ['files', 'classmates', 'zaznamnik'];

export interface SubjectDrawerSheetProps {
  sheet: SubjectDrawerSheetData;
  onClose: () => void;
}

/**
 * Full-size sheet for a single subject: header, five-tab icon bar, the
 * shared `DrawerTabBody` beneath. No IS footer since #341 — see below; the
 * title linking the syllabus is the one IS link kept, as the extension has it.
 *
 * Selection/drag props passed to `DrawerTabBody` are mouse-only concerns
 * (rubber-band rectangle select) that don't translate to touch, so this sheet
 * hardcodes `isDragging`/`selectionBoxStyle`/`showDragHint` to their off
 * states — there is no rectangle to draw and no hint to teach on a phone —
 * and passes `selectable={false}` to drop the per-row checkboxes: with no
 * ctrl-click, no drag-select and no bulk-download bar on a phone, the only
 * thing a checkbox could do is select one row at a time. Files open or
 * download from the row itself. `selectedIds`/`toggleSelect` are still
 * threaded through because `DrawerTabBody` requires them.
 */
export function SubjectDrawerSheet({ sheet, onClose }: SubjectDrawerSheetProps) {
  const { courseCode, courseName, courseId } = sheet;
  const { t, language } = useTranslation();
  const { getSubject } = useSubjects();
  // "NOVÉ" on documents changed since the last open, as in the extension.
  const lastVisitedAt = useFileLastVisit(courseCode, true);
  // Mirrors desktop's useSubjectFileDrawerState: files/classmates/zaznamnik
  // need a subjectId (an enrolled subject) to fetch anything, so a subject
  // not yet resolved to one opens on Success rate instead of a dead tab.
  const [activeTab, setActiveTab] = useState<DrawerTab>(() => {
    const enrolled = !!getSubject(courseCode)?.subjectId;
    if (sheet.initialTab && (enrolled || !NO_ID_DISABLED.includes(sheet.initialTab)))
      return sheet.initialTab;
    return enrolled ? 'files' : 'stats';
  });
  // The tab asked for but not yet usable (the subject has no id until the
  // subjects load: a notification tap that cold-starts the app). It is taken
  // once the subject resolves, and only then; later the student's own choice wins.
  const pendingTab = useRef(
    sheet.initialTab && sheet.initialTab !== activeTab ? sheet.initialTab : null
  );
  const enrolledNow = !!getSubject(courseCode)?.subjectId;
  useEffect(() => {
    if (!enrolledNow || !pendingTab.current) return;
    setActiveTab(pendingTab.current);
    pendingTab.current = null;
  }, [enrolledNow]);
  // The student's own tap or swipe: it wins over a tab still pending.
  const chooseTab = (tab: DrawerTab) => {
    pendingTab.current = null;
    setActiveTab(tab);
  };
  // A sheet on the stack is open; its Záznamník tab on screen means seen.
  useMarkZaznamnikSeen(courseCode, activeTab, true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const ignoreClickRef = useRef(false);

  const subjectInfo = getSubject(courseCode);
  // The student's name for it, for what they read: the header and the reader's
  // title. The syllabus lookup and the lesson below keep IS's name.
  const displayName = useCourseName(courseCode, courseName);
  const { schedule } = useSchedule();
  const { isSyncing } = useSyncStatus();
  // Tapping a PDF opens it in the reader rather than exporting it: on iOS the
  // download path is the share sheet, so "just let me read page 3" meant saving
  // the file out of the app first. The row's own download button is untouched.
  const resolvedCourseId =
    courseId || schedule.find((s) => s.courseCode === courseCode && s.courseId)?.courseId || '';

  const { files, isLoading: isFilesLoading } = useFiles(courseCode);
  const groupedFiles = groupAndSortFiles(files, courseCode, t);
  // The course keys the iPad reader's ink and PDF cache, and its PDFs fill the
  // reader's sidebar so a student can switch files without coming back here —
  // in the drawer's grouped order, so both lists read the same.
  const {
    previewUrl,
    previewPosition,
    viewPdf,
    closePreview,
    onPreviewLoaded,
    openFile,
    downloadSingle,
    openingLink,
    activeDownloads,
  } = usePdfPreview(courseCode, {
    title: displayName,
    files: listSubjectPdfs(groupedFiles.flatMap((g) => g.files)),
  });
  const { classmates } = useClassmates(courseCode);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const { data: zaznamnikData } = useZaznamnik(courseCode);
  const { assignments: boxes } = useOdevzdavarny(subjectInfo?.subjectId);
  const syllabusResult = useSyllabus(courseCode, resolvedCourseId, courseName);

  const filesCount = files?.reduce((acc, f) => acc + f.files.length, 0) ?? 0;
  const impersonating = useAppStore((s) => s.impersonation != null);
  const zaznamnikCount = zaznamnikTabCount(zaznamnikData, boxes.length, impersonating);
  const counts: Partial<Record<DrawerTab, number | undefined>> = {
    files: filesCount,
    classmates: classmates?.length,
    zaznamnik: zaznamnikCount,
  };

  const disabledTabs = subjectInfo?.subjectId ? [] : NO_ID_DISABLED;

  const toggleSelect = (id: string, e: SyntheticEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const lesson: SelectedSubject = {
    courseCode,
    courseName: courseName || courseCode,
    courseId: resolvedCourseId,
    id: courseCode,
  };

  return (
    <Sheet size="full" variant="screen" onClose={onClose}>
      <SubjectDrawerScroller
        courseCode={courseCode}
        pullable={activeTab === 'files'}
        onSwipeStep={(steps) =>
          chooseTab(stepTab(SUBJECT_TAB_ORDER, activeTab, steps, disabledTabs))
        }
        top={
          <>
            <SubjectSheetHeader
              courseCode={courseCode}
              isName={courseName || courseCode}
              titleHref={resolvedCourseId ? syllabusUrl(resolvedCourseId, language) : undefined}
              onBack={onClose}
              action={
                activeTab === 'files' && <SubjectFilesRefreshButton courseCode={courseCode} />
              }
            />
            {sheet.weekLesson && <WeekLessonPlace lesson={sheet.weekLesson} />}
            {/* Below the header, not inside it: the header is `touch-none` so the
                sheet can be dragged by it, and this is a list of things to tap. */}
            <TeacherList teachers={syllabusResult.syllabus?.courseInfo?.teachers} />
            <SubjectDrawerTabs
              activeTab={activeTab}
              onTabChange={chooseTab}
              disabledTabs={disabledTabs}
              counts={counts}
            />
          </>
        }
      >
        <DrawerTabBody
          tab={activeTab}
          lesson={lesson}
          files={files}
          isFilesLoading={isFilesLoading}
          isSyncing={isSyncing}
          isDragging={false}
          selectionBoxStyle={null}
          showDragHint={false}
          groupedFiles={groupedFiles}
          selectedIds={selectedIds}
          fileRefs={fileRefs}
          ignoreClickRef={ignoreClickRef}
          toggleSelect={toggleSelect}
          openFile={openFile}
          onViewPdf={viewPdf}
          openingLink={openingLink}
          downloadingLinks={activeDownloads}
          onDownloadSingle={downloadSingle}
          resolvedCourseId={resolvedCourseId}
          syllabusResult={syllabusResult}
          folderUrl={subjectInfo?.folderUrl}
          selectable={false}
          // Off since this sheet pinned an 'Otevřít v IS MENDELU' footer, which
          // made every tab show two identical links. #341 dropped that footer
          // (it opened the file structure whatever the tab), so the tabs here
          // carry no IS link. The exceptions are the title, which links the
          // syllabus as the extension's drawer title does (Dominik's call), the
          // classmates tab's no-cvičení state, whose answer is that link, and
          // the záznamník, whose IS links ignore this flag (an IS outage or a
          // missing mark is when a student needs the original).
          showIsBacklink={false}
          // A classmate tap reaches the same PersonSheet the Lidé search
          // opens. Without this it landed in ClassmatePersonDrawer — a second
          // person view with no office, no phone and no map button, so the
          // same student looked different depending on where you tapped them.
          onSelectPerson={(classmate) =>
            pushSheet({
              kind: 'person',
              personId: String(classmate.personId),
              personName: classmate.name,
            })
          }
          // The programme line only ever rendered clipped mid-word on a phone.
          showStudyInfo={false}
          lastVisitedAt={lastVisitedAt}
        />
      </SubjectDrawerScroller>
      {previewUrl && (
        <SubjectPdfOverlay
          url={previewUrl}
          position={previewPosition}
          onClose={closePreview}
          onLoaded={onPreviewLoaded}
        />
      )}
    </Sheet>
  );
}
