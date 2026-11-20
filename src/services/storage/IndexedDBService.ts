import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  SubjectsData,
  SyllabusRequirements,
  ParsedFile,
  GradeHistory,
  DocumentNote,
  NoteImage,
} from '../../types/documents';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ExamSubject } from '../../types/exams';
import type { ClassmatesData } from '../../types/classmates';
import type { StudyPlan, DualLanguageStudyPlan } from '../../types/studyPlan';
import type { CvicnyTest } from '../../api/cvicneTests';
import type { Odevzdavarna } from '../../api/odevzdavarny';
import type { ErasmusCountryData } from '../../types/erasmus';
import type { HiddenItems, CalendarCustomEvent } from '../../types/calendarTypes';
import type { SubjectZaznamnik } from '../../types/zaznamnik';
import { StoreSchemas, type StoreName } from '../../types/storage';
import { putAcross } from './putAcross';

interface ReisDB extends DBSchema {
  files: {
    key: string;
    value: ParsedFile[] | { cz: ParsedFile[]; en: ParsedFile[] }; // Key is courseCode
  };
  assessments: {
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any; // Legacy store — kept for backward compatibility
  };
  syllabuses: {
    key: string;
    value: SyllabusRequirements | { cz: SyllabusRequirements; en: SyllabusRequirements }; // Key is courseCode
  };
  classmates: {
    key: string;
    // Keys are either `${courseCode}` (course classmates) or `exam:${terminId}` (per-exam-term classmates)
    value: ClassmatesData;
  };
  exams: {
    key: string;
    value: ExamSubject[];
  };
  schedule: {
    key: string;
    value: BlockLesson[];
  };
  subjects: {
    key: string;
    value: SubjectsData;
  };
  success_rates: {
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
  };
  meta: {
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
  };
  grade_history: {
    key: string;
    value: GradeHistory;
  };
  study_plan: {
    key: string;
    value: StudyPlan | DualLanguageStudyPlan;
  };
  cvicne_tests: {
    key: string;
    value: CvicnyTest[];
  };
  odevzdavarny: {
    key: string;
    value: Odevzdavarna[];
  };
  erasmus: {
    key: string;
    value: ErasmusCountryData;
  };
  document_notes: {
    key: string;
    value: DocumentNote;
  };
  note_images: {
    key: string;
    value: NoteImage;
  };
  hidden_items: {
    key: string;
    value: HiddenItems;
  };
  custom_events: {
    key: string;
    value: CalendarCustomEvent;
  };
  zaznamnik: {
    key: string;
    value: SubjectZaznamnik | null; // Key is courseCode
  };
  map_rooms: {
    key: string; // String(buildingId), e.g. "0" for Q
    value: import('../../types/campusMap').RoomsCollection;
  };
  map_models: {
    key: string; // String(buildingId) — the 3D building card's glb + metadata
    value: import('../../types/buildingModel').BuildingModel;
  };
}

// Mock/demo mode (VITE_USE_MOCK_DATA=true) uses a SEPARATE database so its
// seeded society data can never bleed into the real one. IndexedDB is
// origin-scoped and the standalone dev webapp serves every mode from the same
// origin (localhost), so without this split a demo/screenshot run and a
// real-data run would share `reis_db` — and flipping the flag off does not clean
// up, so leftover mock (e.g. the ESN "Czech Language for Foreigners" exam) would
// hydrate on the next real-data boot. The production extension never sets the
// flag, so it always uses `reis_db`.
// `import.meta.env?.` — not `.env.` — because this module is also loaded in
// plain Node by `scripts/scrape-real-data.ts`, where `import.meta.env` is
// undefined (it is a Vite construct). The unguarded read threw
// "Cannot read properties of undefined" AFTER the IS login had succeeded, so
// `npm run scrape:real` failed on every machine and the real-data snapshot
// could never be built. Same guard as `errorReporter/reporter.ts:19`.
const DB_NAME = import.meta.env?.VITE_USE_MOCK_DATA === 'true' ? 'reis_db_mock' : 'reis_db';
const DB_VERSION = 23;

/**
 * The `meta` key holding the random per-install id.
 *
 * Declared here rather than in `services/identity/installId.ts` so `clearAll`
 * can spare it without importing that module — which imports this one, and
 * would close a cycle.
 */
export const INSTALL_ID_KEY = 'install_id';

/**
 * The `meta` key holding the phone's store-rating history (days used, files
 * read, the day reIS last asked; see `mobile/storeReview.ts`). Per install like
 * the install id, and with nothing about the student in it, so `clearAll`
 * spares it: wiping it on sign-out restarted the 120-day break between asks.
 */
export const STORE_REVIEW_KEY = 'store_review';

/**
 * The `meta` key holding how often the critical-update pop-up appeared (see
 * `mobile/criticalUpdate.ts`). Per install, nothing about the student, and
 * spared by `clearAll`: a sign-out must not buy two more pop-ups.
 */
export const CRITICAL_POPUP_KEY = 'critical_update_popup';

/** The `meta` keys that outlive a sign-out. */
const PER_INSTALL_META_KEYS = [INSTALL_ID_KEY, STORE_REVIEW_KEY, CRITICAL_POPUP_KEY];

// True for the "database connection is closing" / InvalidStateError family that
// a stale handle throws after the underlying connection was closed.
function isConnectionClosing(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'InvalidStateError') return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /connection is closing|InvalidStateError/i.test(msg);
}

class IndexedDBServiceImpl {
  // Null when no live connection is held. Self-healing: any close (another tab
  // upgrading the DB, the extension context being invalidated, or the browser
  // reaping an idle connection) resets this so the next call reopens, instead
  // of forever awaiting a dead handle that throws "connection is closing".
  private dbPromise: Promise<IDBPDatabase<ReisDB>> | null = null;

  private getDB(): Promise<IDBPDatabase<ReisDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<ReisDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          const requiredStores: (keyof ReisDB)[] = [
            'files',
            'assessments',
            'syllabuses',
            'classmates',
            'exams',
            'schedule',
            'subjects',
            'success_rates',
            'meta',
            'grade_history',
            'study_plan',
            'cvicne_tests',
            'odevzdavarny',
            'erasmus',
            'document_notes',
            'note_images',
            'hidden_items',
            'custom_events',
            'zaznamnik',
            'map_rooms',
            'map_models',
          ];

          requiredStores.forEach((store) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!db.objectStoreNames.contains(store as any)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              db.createObjectStore(store as any);
            }
          });

          // Stores for features that were removed. Dropping the store is not
          // housekeeping: an upgrade that only ever creates would leave the
          // last WebISKAM snapshot — dorm contract, room number, meal
          // transactions — sitting in IndexedDB forever on every existing
          // install, with nothing left in the app that could ever show or
          // clear it. v22 removed the ISKAM integration.
          const droppedStores = ['iskam'];
          droppedStores.forEach((store) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (db.objectStoreNames.contains(store as any)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              db.deleteObjectStore(store as any);
            }
          });
        },
        // A newer DB version (e.g. after an extension update) wants to
        // open: step aside by closing our connection and dropping the
        // handle, so the next call reopens at the new version.
        blocking: () => {
          const closing = this.dbPromise;
          this.dbPromise = null;
          void closing?.then((db) => db.close()).catch(() => {});
        },
        // Browser closed the connection unexpectedly. Force a reopen.
        terminated: () => {
          this.dbPromise = null;
        },
      }).catch((err) => {
        this.dbPromise = null;
        throw err;
      });
    }
    return this.dbPromise;
  }

  // Runs a DB operation, transparently reopening and retrying once if it fails
  // because the connection was closing. Single funnel so the self-heal lives
  // in one place rather than a try/catch at every call site.
  private async run<T>(op: (db: IDBPDatabase<ReisDB>) => Promise<T>): Promise<T> {
    try {
      return await op(await this.getDB());
    } catch (e) {
      if (!isConnectionClosing(e)) throw e;
      this.dbPromise = null;
      return await op(await this.getDB());
    }
  }

  private validate<K extends StoreName>(
    storeName: K,
    value: unknown
  ): ReisDB[K]['value'] | undefined {
    const schema = StoreSchemas[storeName];
    const result = schema.safeParse(value);
    if (!result.success) return undefined;
    return result.data as ReisDB[K]['value'];
  }

  async get<K extends StoreName>(
    storeName: K,
    key: string
  ): Promise<ReisDB[K]['value'] | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = await this.run((db) => db.get(storeName as any, key));
    // A truthiness check here (`value ? ... : undefined`) would read back a
    // stored `false` — a real, legitimate value for boolean meta keys like
    // the crash-report opt-out — as "missing" and silently fall back to
    // whatever default the caller uses for undefined. Check for the actual
    // "not found" sentinel instead.
    return value !== undefined ? this.validate(storeName, value) : undefined;
  }

  async set<K extends StoreName>(
    storeName: K,
    key: string,
    value: ReisDB[K]['value']
  ): Promise<void> {
    // Validate before saving to prevent corrupt data ingress. Check against
    // `undefined` specifically (validate()'s actual failure sentinel) rather
    // than falsiness — a truthiness check here would drop a legitimate
    // `false`/`0`/`''`/`null` value, e.g. the crash-report opt-out.
    const validated = this.validate(storeName, value);
    if (validated === undefined) return; // Drop invalid data rather than saving it

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.run((db) => db.put(storeName as any, validated, key));
  }

  async setMany<K extends StoreName>(
    storeName: K,
    entries: Array<readonly [string, ReisDB[K]['value']]>
  ): Promise<void> {
    if (entries.length === 0) return;
    const validated = entries
      .map(([key, value]) => [key, this.validate(storeName, value)] as const)
      .filter((e): e is readonly [string, ReisDB[K]['value']] => e[1] !== undefined);
    if (validated.length === 0) return;

    await this.run(async (db) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = db.transaction(storeName as any, 'readwrite');
      const store = tx.store;
      for (const [key, value] of validated) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        store.put(value as any, key);
      }
      await tx.done;
    });
  }

  /**
   * Puts into several stores in ONE readwrite transaction: all of it lands or
   * none of it does. For writes that only make sense together, like a fresh
   * záznamník and the "Nové body" entry derived from comparing it.
   */
  async setAcross(
    writes: Array<
      { [K in StoreName]: { store: K; key: string; value: ReisDB[K]['value'] } }[StoreName]
    >
  ): Promise<void> {
    const validated = writes
      .map((w) => ({ ...w, value: this.validate(w.store, w.value) }))
      .filter((w) => w.value !== undefined);
    if (validated.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.run((db) => putAcross(db as any, validated));
  }

  /**
   * Puts and deletes in one store, in ONE readwrite transaction: all of it
   * lands or none of it does. Unlike setMany, an invalid value is not skipped:
   * the deletes beside it may only be right because it lands, so the whole
   * batch is refused.
   */
  async replaceMany<K extends StoreName>(
    storeName: K,
    puts: Array<readonly [string, ReisDB[K]['value']]>,
    deletes: string[]
  ): Promise<void> {
    const validated = puts.map(([key, value]) => {
      const v = this.validate(storeName, value);
      if (v === undefined) throw new Error(`replaceMany: invalid ${String(storeName)} '${key}'`);
      return [key, v] as const;
    });
    if (validated.length === 0 && deletes.length === 0) return;
    await this.run(async (db) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tx = db.transaction(storeName as any, 'readwrite');
      const ops: Promise<unknown>[] = [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const [key, value] of validated) ops.push(tx.store.put(value as any, key));
        for (const key of deletes) ops.push(tx.store.delete(key));
      } catch (err) {
        // A throwing put does not abort on its own (see putAcross).
        for (const p of [...ops, tx.done]) p.catch(() => {});
        tx.abort();
        throw err;
      }
      await Promise.all([...ops, tx.done]);
    });
  }

  async delete<K extends keyof ReisDB>(storeName: K, key: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.run((db) => db.delete(storeName as any, key));
  }

  async clear<K extends keyof ReisDB>(storeName: K): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.run((db) => db.clear(storeName as any));
  }

  /**
   * Clears every store, except the random install id.
   *
   * Sign-out is the caller (`api/proxyClient.ts`, `mobile/signOut.ts`), and a
   * wholesale wipe used to take `meta`'s `install_id` with it. The next open
   * then minted a fresh UUID and the admin console counted the same device as a
   * brand new install — an overcount with no upside, since the id is a random
   * 128-bit value with no relationship to the student (see
   * `services/identity/installId.ts`). Keeping it therefore retains nothing
   * about the person signing out. `createDemoSlice.ts` states the general rule:
   * `meta` is deleted by key, never cleared wholesale.
   *
   * Read and rewrite happen inside the same readwrite transaction, so there is
   * no window in which a concurrent `getInstallId()` sees the store empty and
   * mints a replacement.
   */
  async clearAll(): Promise<void> {
    await this.run(async (db) => {
      const stores = Array.from(db.objectStoreNames);
      if (stores.length === 0) return;
      const tx = db.transaction(stores, 'readwrite');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const meta = stores.includes('meta') ? tx.objectStore('meta' as any) : null;
      const kept = meta
        ? await Promise.all(PER_INSTALL_META_KEYS.map(async (k) => [k, await meta.get(k)] as const))
        : [];
      for (const store of stores) {
        tx.objectStore(store).clear();
      }
      for (const [key, value] of kept) {
        if (key === INSTALL_ID_KEY && !(typeof value === 'string' && value.length > 0)) continue;
        if (value !== undefined) meta?.put(value, key);
      }
      await tx.done;
    });
  }

  async getAll<K extends StoreName>(storeName: K): Promise<ReisDB[K]['value'][]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values = await this.run((db) => db.getAll(storeName as any));
    return values
      .map((v) => this.validate(storeName, v))
      .filter((v): v is ReisDB[K]['value'] => v !== undefined);
  }

  async getAllWithKeys<K extends StoreName>(
    storeName: K
  ): Promise<{ key: string; value: ReisDB[K]['value'] }[]> {
    const [keys, values] = await this.run((db) =>
      Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db.getAllKeys(storeName as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        db.getAll(storeName as any),
      ])
    );

    return (keys as string[])
      .map((key, i) => {
        const value = this.validate(storeName, values[i]);
        return value !== undefined ? { key, value } : null;
      })
      .filter((item): item is { key: string; value: ReisDB[K]['value'] } => item !== null);
  }
}

export const IndexedDBService = new IndexedDBServiceImpl();
