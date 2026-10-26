import { useCallback, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { getDocumentNoteKey } from '../../store/slices/createNotesSlice';

/**
 * The web viewer's reading position for one opener: `loadPosition` runs beside
 * the PDF fetch, `viewerPosition` is spread onto <PdfViewer>. Keyed like the
 * study notes and the iPad's ink (`courseCode:fileLink`), so a file has one
 * identity everywhere. Without a course code nothing is remembered.
 */
export function usePdfReadingPosition(courseCode?: string) {
  const [position, setPosition] = useState<{ key: string; page: number | null } | null>(null);

  const loadPosition = useCallback(
    async (link: string) => {
      if (!courseCode) {
        setPosition(null);
        return;
      }
      const key = getDocumentNoteKey(courseCode, link);
      const page = await useAppStore.getState().loadPdfPosition(key);
      setPosition({ key, page });
    },
    [courseCode]
  );

  const viewerPosition = useMemo(
    () => ({
      initialPage: position?.page ?? null,
      onPageChange: position
        ? (page: number) => void useAppStore.getState().savePdfPosition(position.key, page)
        : undefined,
    }),
    [position]
  );

  return { loadPosition, viewerPosition };
}
