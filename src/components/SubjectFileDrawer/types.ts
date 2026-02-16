/**
 * SubjectFileDrawer Types
 * 
 * Shared types for SubjectFileDrawer subcomponents.
 */

import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile, CourseMetadata, SubjectInfo } from '../../types/documents';
import type { SelectedSubject } from '../../types/app';

export interface DrawerHeaderProps {
    lesson: BlockLesson | SelectedSubject | null;
    courseId: string;
    courseInfo?: CourseMetadata; // New: metadata for search/sidebar view
    subjectInfo?: SubjectInfo | null;
    selectedCount: number;
    isDownloading: boolean;
    downloadProgress?: { completed: number; total: number } | null;
    activeTab: 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates';
    onClose: () => void;
    onDownload: () => void;
    onTabChange: (tab: 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates') => void;
}

export interface FileGroup {
    name: string;
    displayName: string;
    files: ParsedFile[];
}

export interface FileListProps {
    groups: FileGroup[];
    selectedIds: string[];
    fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
    ignoreClickRef: React.MutableRefObject<boolean>;
    onToggleSelect: (id: string, e: React.MouseEvent) => void;
    onOpenFile: (link: string) => void;
    folderUrl?: string;
}

export interface DragSelectionState {
    isDragging: boolean;
    selectionStart: { x: number; y: number } | null;
    selectionEnd: { x: number; y: number } | null;
    selectedIds: string[];
}
