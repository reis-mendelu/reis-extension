import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { logError } from '../../utils/reportError';

/** One file's place: the 0-based page, and when it was read (for the cap). */
export interface PdfPosition {
  page: number;
  at: number;
}

export interface PdfPositionsSlice {
  /** `courseCode:fileLink` (getDocumentNoteKey) → where the web viewer left it. */
  pdfPositions: Record<string, PdfPosition>;
  /** The page to reopen a file on, or null if it was never read. */
  loadPdfPosition: (key: string) => Promise<number | null>;
  savePdfPosition: (key: string, page: number) => Promise<void>;
}

/**
 * The web viewer's (pdf.js: the extension, Android, iPhone) reading positions.
 * One `meta` key holding a capped map, not a store of its own: a new store is a
 * DB_VERSION bump, and a position is small and worth little once a semester is
 * over. The iPad's native reader keeps its own in the PDF cache index
 * (src/mobile/pdfCache.ts), next to the bytes it describes.
 */
export const PDF_POSITIONS_KEY = 'pdf_positions';
/** About two semesters of lecture decks; the longest-unread go first. */
export const PDF_POSITIONS_CAP = 300;

function isPosition(v: unknown): v is PdfPosition {
  const p = v as PdfPosition | null;
  return (
    !!p &&
    typeof p === 'object' &&
    Number.isInteger(p.page) &&
    p.page >= 0 &&
    typeof p.at === 'number'
  );
}

/** Keeps the well-formed entries of whatever the store held. */
function readPositions(v: unknown): Record<string, PdfPosition> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([, p]) => isPosition(p)));
}

function capped(map: Record<string, PdfPosition>): Record<string, PdfPosition> {
  const entries = Object.entries(map);
  if (entries.length <= PDF_POSITIONS_CAP) return map;
  entries.sort(([, a], [, b]) => b.at - a.at);
  return Object.fromEntries(entries.slice(0, PDF_POSITIONS_CAP));
}

// Read once per session. A save that arrives first waits for it, so it can
// never write a map that is missing every other file.
let hydration: Promise<void> | null = null;

export function __resetPdfPositionsForTests(): void {
  hydration = null;
}

export const createPdfPositionsSlice: AppSlice<PdfPositionsSlice> = (set, get) => {
  const hydrate = () => {
    if (!hydration) {
      hydration = IndexedDBService.get('meta', PDF_POSITIONS_KEY)
        .then((stored) => {
          // Anything saved in memory meanwhile is newer than the store.
          set({ pdfPositions: { ...readPositions(stored), ...get().pdfPositions } });
        })
        .catch((error: unknown) => logError('PdfPositionsSlice.hydrate', error));
    }
    return hydration;
  };

  return {
    pdfPositions: {},

    loadPdfPosition: async (key) => {
      await hydrate();
      return get().pdfPositions[key]?.page ?? null;
    },

    savePdfPosition: async (key, page) => {
      if (!Number.isInteger(page) || page < 0) return;
      await hydrate();
      const next = capped({ ...get().pdfPositions, [key]: { page, at: Date.now() } });
      set({ pdfPositions: next });
      try {
        await IndexedDBService.set('meta', PDF_POSITIONS_KEY, next);
      } catch (error) {
        logError('PdfPositionsSlice.save', error);
      }
    },
  };
};
