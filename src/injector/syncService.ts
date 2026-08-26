import pLimit from 'p-limit';
import { Messages } from '../types/messages';
import { fetchDualLanguageExams } from '../api/exams';
import { fetchDualLanguageSubjects } from '../api/subjects';
import { fetchDualLanguagePastSubjects } from '../api/pastSubjects';
import { fetchFilesFromFolder } from '../api/documents';
import { fetchDualLanguageStudyPlan } from '../api/studyPlan';
import { fetchStudyStats } from '../api/studyStats';
import { fetchStudyComparison } from '../api/studyComparison';
import { fetchSyllabus, SYLLABUS_FETCH_FAILED } from '../api/syllabus';
import { syncZaznamnik } from '../services/sync/syncZaznamnik';
import { syncCvicneTests } from '../services/sync/syncCvicneTests';
import { syncOdevzdavarny } from '../services/sync/syncOdevzdavarny';
import { fetchSeminarGroupIds, fetchClassmates } from '../api/classmates';
import { mergePastSubjects } from '../services/sync/mergePastSubjects';
import { syncPastSemesters } from '../services/sync/syncPastSemesters';

import { getUserParams } from '../utils/userParams';
import { fetchFullSemesterSchedule } from './dataFetchers';
import { sendToIframe } from './iframeManager';
import { TTL, ttlGated, isFresh, markFetched } from './syncTtl';
import type { SyncedData } from '../types/messages';
import { IndexedDBService } from '../services/storage/IndexedDBService';
import { syncDriveBackup, type DriveBackupSubject } from '../services/drive/driveBackup';
import { syncDriveNotesBackup } from '../services/drive/driveNotesBackup';
import { NOTES_ENABLED } from '../config/featureFlags';
import type { SubjectNotes } from '../services/drive/notesDoc';
import { singleFlight } from '../utils/singleFlight';
import { logError } from '../utils/reportError';
import type { ParsedFile, SubjectsData } from '../types/documents';

const limit = pLimit(3);
export let cachedData: SyncedData = { lastSync: 0 };
export let isSyncing = false;

/** Latest notes snapshot pushed from the iframe (it owns the notes IDB). */
export function setNotesSnapshot(
  notes: Record<string, Record<string, { note: string; fileName: string }>>
) {
  cachedData = { ...cachedData, notes };
}

/** Per-subject base64-inlined HTML pushed by the iframe for image-bearing notes.
 *  Used in place of the text-only render so card images reach the Drive Doc. */
const notesHtmlOverrides: Record<string, string> = {};
export function setNotesHtmlOverride(code: string, html: string): void {
  notesHtmlOverrides[code] = html;
}
let currentSemesterCodes: string[] = [];

/**
 * Last past-subject payload we successfully fetched.
 *
 * `mergePastSubjects` folds these into each newly fetched subject list, and the
 * two have different TTLs — so the subjects fetch comes back due while this one
 * is still fresh. Without a retained copy that run would replace the merged map
 * with a current-semester-only one, and fulfilled subjects would vanish from
 * the UI until the longer TTL expired.
 */
let lastPastSubjects: { cz: Record<string, unknown>; en: Record<string, unknown> } | null = null;

export async function syncAllData() {
  if (isSyncing) return;

  isSyncing = true;

  try {
    // Inside the try on purpose: this used to sit above it, so a throw here
    // left isSyncing stuck true and no sync ever ran again.
    sendToIframe(Messages.syncUpdate({ isSyncing: true, lastSync: cachedData.lastSync }));

    /**
     * Hands one Phase 2 result to the UI the moment it lands.
     *
     * Phase 2 fetches nine things in parallel and then posted all of them in a
     * single message once the slowest had finished, so the timetable waited on
     * a study comparison nobody was looking at. Each screen gates on its own
     * data, so an early partial paints that screen and leaves the others on
     * their skeletons — which is what the student is actually waiting for.
     *
     * `isSyncing` stays true: the crawl is not over, and the app's
     * `firstSyncSettled` latch keys off the false that ends it.
     */
    const pushEarly = (partial: Partial<SyncedData>) =>
      sendToIframe(
        Messages.syncUpdate({ ...partial, isSyncing: true, lastSync: cachedData.lastSync })
      );

    const userParams = await getUserParams();
    const studium = userParams?.studium;

    // Phase 2a: Start subjects early — fast fetch (explicit obdobi prevents session-state coupling)
    const subjectsPromise = ttlGated('subjects', TTL.DAILY, !!cachedData.subjects, () =>
      fetchDualLanguageSubjects(studium || undefined, userParams?.obdobi || undefined)
    ).then((result) => {
      if (result) {
        cachedData = { ...cachedData, subjects: result.subjects, attendance: result.attendance };
        // Capture current-semester codes BEFORE mergePastSubjects adds past ones —
        // the Drive backup is scoped to the current semester only.
        currentSemesterCodes = result.subjects?.data ? Object.keys(result.subjects.data) : [];
      }
      return result;
    });

    // Phase 2a-II: Fetch study plan + study stats concurrently with early subjects
    const studyPlanPromise = studium
      ? ttlGated('studyPlan', TTL.SEMESTER, !!cachedData.studyPlan, () =>
          fetchDualLanguageStudyPlan(studium)
        ).then((plan) => {
          if (plan) {
            cachedData = { ...cachedData, studyPlan: plan };
            pushEarly({ studyPlan: plan });
          }
          return plan;
        })
      : Promise.resolve(null);

    // Past-semester folders from doc server history — used to backfill
    // SubjectInfo for fulfilled subjects that list.pl no longer returns.
    const pastSubjectsPromise = ttlGated('pastSubjects', TTL.SEMESTER, !!lastPastSubjects, () =>
      fetchDualLanguagePastSubjects()
    ).then((value) => {
      if (value) lastPastSubjects = value as typeof lastPastSubjects;
      return value;
    });

    const studyStatsPromise =
      studium && userParams?.obdobi
        ? ttlGated('studyStats', TTL.DAILY, !!cachedData.studyStats, () =>
            fetchStudyStats(studium, userParams.obdobi!)
          ).then((stats) => {
            if (stats) {
              cachedData = { ...cachedData, studyStats: stats };
              pushEarly({ studyStats: stats });
            }
            return stats;
          })
        : Promise.resolve(null);

    const studyComparisonPromise =
      studium && userParams?.obdobi
        ? ttlGated('studyComparison', TTL.DAILY, !!cachedData.studyComparison, () =>
            fetchStudyComparison(studium, userParams.obdobi!)
          ).then((c) => {
            if (c) cachedData = { ...cachedData, studyComparison: c };
            return c;
          })
        : Promise.resolve(null);

    const cvicneTestsPromise = studium
      ? ttlGated('cvicneTests', TTL.DAILY, !!cachedData.cvicneTests, () =>
          syncCvicneTests(studium)
        ).then((result) => {
          if (result) {
            cachedData = { ...cachedData, cvicneTests: result.tests };
          }
          return result;
        })
      : Promise.resolve(null);

    const odevzdavarnyPromise =
      studium && userParams?.obdobi
        ? syncOdevzdavarny(studium, userParams.obdobi).then((result) => {
            if (result) {
              cachedData = { ...cachedData, odevzdavarny: result.assignments };
            }
            return result;
          })
        : Promise.resolve(null);

    // Phase 2b: Full schedule + exams in parallel (subjects/studyPlan/studyStats re-uses already-started promises)
    // Named rather than inline in the allSettled below, so each can post the
    // moment it resolves. These two are the screens a student opens first.
    const schedulePromise = ttlGated('schedule', TTL.SEMESTER, !!cachedData.schedule, () =>
      fetchFullSemesterSchedule()
    ).then((value) => {
      if (value) {
        cachedData = { ...cachedData, schedule: value };
        pushEarly({ schedule: value });
      }
      return value;
    });

    // exams and odevzdavarny stay hot: registration state and submission
    // deadlines are the two things that genuinely move within a day.
    const examsPromise = fetchDualLanguageExams().then((value) => {
      if (value.length > 0) {
        cachedData = { ...cachedData, exams: value };
        pushEarly({ exams: value });
      }
      return value;
    });

    const [
      fullSchedule,
      exams,
      subjects,
      studyPlan,
      studyStats,
      cvicneTests,
      odevzdavarnyResult,
      pastSubjects,
      studyComparison,
    ] = await Promise.allSettled([
      schedulePromise,
      examsPromise,
      subjectsPromise,
      studyPlanPromise,
      studyStatsPromise,
      cvicneTestsPromise,
      odevzdavarnyPromise,
      pastSubjectsPromise,
      studyComparisonPromise,
    ]);

    // Falls back to the retained copy when the past-subject fetch was skipped as
    // fresh, so a subjects refresh still gets its merge.
    const pastSubjectsForMerge =
      pastSubjects.status === 'fulfilled' && pastSubjects.value
        ? pastSubjects.value
        : lastPastSubjects;

    if (subjects.status === 'fulfilled' && subjects.value && pastSubjectsForMerge) {
      // Inject already-cached past semester subjects (richer data than dok_server)
      // before mergePastSubjects so dok_server only fills truly old subjects.
      if (studium && userParams?.obdobi && subjects.value.availablePeriods.length > 0) {
        const pastPeriods = subjects.value.availablePeriods.filter(
          (p) => p.id !== userParams!.obdobi
        );
        for (const period of pastPeriods) {
          const cached = (await IndexedDBService.get('meta', `past_semester_${period.id}`)) as
            | { subjects: { data: typeof subjects.value.subjects.data }; attendance: unknown }
            | undefined;
          if (cached?.subjects?.data) {
            for (const [code, info] of Object.entries(cached.subjects.data)) {
              if (!subjects.value.subjects.data[code]) {
                subjects.value.subjects.data[code] = info;
              }
            }
          }
        }
      }

      mergePastSubjects(
        subjects.value.subjects,
        pastSubjectsForMerge as Parameters<typeof mergePastSubjects>[1],
        studyPlan.status === 'fulfilled' ? studyPlan.value : null
      );
    }

    cachedData = {
      ...cachedData,
      schedule:
        fullSchedule.status === 'fulfilled' && fullSchedule.value
          ? fullSchedule.value
          : cachedData.schedule,
      exams:
        exams.status === 'fulfilled' && exams.value.length > 0 ? exams.value : cachedData.exams,
      subjects:
        subjects.status === 'fulfilled' && subjects.value
          ? subjects.value.subjects
          : cachedData.subjects,
      attendance:
        subjects.status === 'fulfilled' && subjects.value
          ? subjects.value.attendance
          : cachedData.attendance,
      studyPlan:
        studyPlan.status === 'fulfilled' && studyPlan.value
          ? studyPlan.value
          : cachedData.studyPlan,
      studyStats:
        studyStats.status === 'fulfilled' && studyStats.value
          ? studyStats.value
          : cachedData.studyStats,
      studyComparison:
        studyComparison.status === 'fulfilled' && studyComparison.value
          ? studyComparison.value
          : cachedData.studyComparison,
      cvicneTests:
        cvicneTests.status === 'fulfilled' && cvicneTests.value?.tests?.length
          ? cvicneTests.value.tests
          : cachedData.cvicneTests,
      odevzdavarny:
        odevzdavarnyResult.status === 'fulfilled' && odevzdavarnyResult.value?.assignments?.length
          ? odevzdavarnyResult.value.assignments
          : cachedData.odevzdavarny,
      files: cachedData.files || {},
      lastSync: Date.now(),
    };

    // Push Phase 2 data (exams, schedule, subjects) to the iframe immediately,
    // before the slow per-subject Phase 3 (files, classmates, zazramnik).
    sendToIframe(
      Messages.syncUpdate({
        exams: cachedData.exams,
        schedule: cachedData.schedule,
        subjects: cachedData.subjects,
        attendance: cachedData.attendance,
        studyPlan: cachedData.studyPlan,
        studyStats: cachedData.studyStats,
        studyComparison: cachedData.studyComparison,
        cvicneTests: cachedData.cvicneTests,
        odevzdavarny: cachedData.odevzdavarny,
        isSyncing: true,
        lastSync: cachedData.lastSync,
      })
    );

    // Falls back to the cached list when the subjects fetch was skipped as
    // fresh — Phase 3 keys off the enrolled subjects, not off a new fetch.
    const subjectsForDetails =
      subjects.status === 'fulfilled' && subjects.value
        ? subjects.value.subjects
        : (cachedData.subjects as SubjectsData | undefined);
    if (subjectsForDetails) {
      await syncSubjectDetails(
        subjectsForDetails,
        fullSchedule.status === 'fulfilled' ? fullSchedule.value : null
      );
    }

    cachedData.lastSync = Date.now();
    sendToIframe(Messages.syncUpdate({ ...cachedData, isSyncing: false }));

    // Fire-and-forget: fetch past semesters once, permanently cache in IDB
    if (
      studium &&
      userParams?.obdobi &&
      subjects.status === 'fulfilled' &&
      subjects.value?.availablePeriods.length
    ) {
      syncPastSemesters(studium, userParams.obdobi, subjects.value.availablePeriods).catch(
        () => {}
      );
    }

    // Fire-and-forget: mirror current-semester files to Google Drive (only if linked).
    // Reuses the listings already fetched into cachedData.files — no extra IS crawling.
    runDriveBackupNow();
  } catch (e) {
    sendToIframe(
      Messages.syncUpdate({ isSyncing: false, error: String(e), lastSync: cachedData.lastSync })
    );
  } finally {
    isSyncing = false;
  }
}

/**
 * Mirror the current semester's already-fetched file listings to Google Drive.
 * Fire-and-forget from the periodic sync, and awaited directly when the user
 * connects (so the first backup starts immediately, without a full IS re-crawl).
 * No-op when nothing is cached yet — the next sync will pick it up.
 */
export async function runDriveBackupNow(): Promise<void> {
  try {
    const subjectsData = (cachedData.subjects as SubjectsData | undefined)?.data;
    const filesData = cachedData.files as Record<string, ParsedFile[]> | undefined;
    if (!currentSemesterCodes.length || !subjectsData || !filesData) return;
    const backupSubjects = currentSemesterCodes
      .map((code): DriveBackupSubject | null => {
        const info = subjectsData[code];
        const files = filesData[code];
        if (!info || !files?.length) return null;
        const folderName = `${code} - ${info.displayName || info.fullName || ''}`.trim();
        return { code, folderName, files };
      })
      .filter((s): s is DriveBackupSubject => s !== null);
    if (backupSubjects.length) await syncDriveBackup(backupSubjects);
    await runNotesBackupNow();
  } catch (e) {
    logError('Drive.backup', e);
  }
}

/** One notes-backup pass over the latest snapshot. Passes an empty list through
 *  too, so a subject whose notes were all deleted gets reconciled (emptied). */
async function notesBackupPass(): Promise<void> {
  if (!NOTES_ENABLED) return; // notes feature dormant — never back up to Drive
  try {
    const notes = cachedData.notes;
    if (!notes) return; // snapshot never pushed yet
    const subjectsData = (cachedData.subjects as SubjectsData | undefined)?.data;
    const subjectNotes: SubjectNotes[] = Object.entries(notes).map(
      ([code, fileMap]): SubjectNotes => {
        const files = Object.entries(fileMap).map(([fileLink, v]) => ({
          fileLink,
          fileName: v.fileName,
          note: v.note,
        }));
        const info = subjectsData?.[code];
        const folderName = info
          ? `${code} - ${info.displayName || info.fullName || ''}`.trim()
          : code;
        return { code, folderName, title: `Poznámky – ${code}`, files };
      }
    );
    await syncDriveNotesBackup(subjectNotes, notesHtmlOverrides); // [] still reconciles manifest orphans
  } catch (e) {
    logError('Drive.notesBackup', e);
  }
}

/**
 * Mirror the iframe-pushed notes snapshot to per-subject Google Docs + sidecars.
 * Coalesced: never overlaps itself, and always runs once more for the latest
 * snapshot if a save arrived mid-pass.
 */
export const runNotesBackupNow: () => Promise<void> = singleFlight(notesBackupPass);

async function syncSubjectDetails(
  subjectsValue: {
    data: Record<string, { folderUrl?: string; subjectId?: string; skupinaId?: string }>;
  },
  scheduleValue: { studyId?: string; periodId?: string }[] | null
) {
  const subjectEntries = Object.entries(subjectsValue.data);
  const userParams = await getUserParams();
  let studium = userParams?.studium;
  let obdobi = userParams?.obdobi;

  if (!studium || !obdobi) {
    const first = Array.isArray(scheduleValue) ? scheduleValue[0] : null;
    studium = studium || first?.studyId;
    obdobi = obdobi || first?.periodId;
  }

  // Phase 3a: Files + syllabus per subject (zaznamnik runs as a separate batched job below)
  const tasks = subjectEntries.map(([code, subject]) =>
    limit(async () => {
      const subjectFull = subject as { folderUrl?: string; subjectId?: string };
      const subTasks = [];
      const cachedFiles = cachedData.files as Record<string, unknown> | undefined;
      const cachedSyllabuses = cachedData.syllabuses as Record<string, unknown> | undefined;
      if (subjectFull.folderUrl)
        subTasks.push(
          // fetchFilesFromFolder recurses two levels deep and follows every
          // pagination link, so this one call is several requests per subject.
          ttlGated(`files:${code}`, TTL.FILES, !!cachedFiles?.[code], () =>
            fetchFilesFromFolder(subjectFull.folderUrl!)
          )
            .then((f) => {
              if (f) (cachedData.files as Record<string, unknown>)[code] = f;
            })
            .catch(() => {})
        );
      if (subjectFull.subjectId)
        subTasks.push(
          ttlGated(`syllabus:${code}`, TTL.SEMESTER, !!cachedSyllabuses?.[code], async () => {
            // fetchSyllabus degrades to a sentinel rather than throwing, and an
            // object always looks "useful" — so without this a transient failure
            // would be stamped fresh and pin the error for a whole semester.
            const syllabus = await fetchSyllabus(subjectFull.subjectId!);
            return syllabus.requirementsText === SYLLABUS_FETCH_FAILED ? null : syllabus;
          })
            .then((s) => {
              if (!s) return;
              if (!cachedData.syllabuses) cachedData.syllabuses = {};
              (cachedData.syllabuses as Record<string, unknown>)[code] = s;
            })
            .catch(() => {})
        );
      await Promise.all(subTasks);
    })
  );

  // Zaznamnik batch — own pLimit(2), preserves prior values via merge guard in slice
  const zaznamnikPromise =
    studium && obdobi
      ? syncZaznamnik(
          studium,
          obdobi,
          subjectEntries.map(([courseCode, s]) => {
            const sf = s as { subjectId?: string; hasPrubezne?: boolean; hasTest?: boolean };
            return {
              courseCode,
              subjectId: sf.subjectId ?? '',
              hasPrubezne: sf.hasPrubezne,
              hasTest: sf.hasTest,
            };
          })
        )
          .then((z) => {
            cachedData.zaznamnik = z;
          })
          .catch(() => {})
      : Promise.resolve();

  await Promise.all([...tasks, zaznamnikPromise]);

  // Phase 3b: Classmates — fetch skupina map once (predmetId→skupinaId),
  // then match to subjects by subjectId to get the right courseCode IDB key
  if (!studium || !obdobi) return;

  // A semester's seminar groups do not change. When every enrolled subject is
  // still fresh there is nothing to fetch — including the shared group map,
  // which would otherwise cost one request per run for no result.
  const cachedClassmates = cachedData.classmates as Record<string, unknown> | undefined;
  const classmatesDue = subjectEntries.filter(
    ([code]) => !cachedClassmates?.[code] || !isFresh(`classmates:${code}`, TTL.SEMESTER)
  );
  if (classmatesDue.length === 0) return;

  try {
    // predmetIdMap: { [predmetId]: skupinaId }
    let predmetIdMap: Record<string, string>;
    try {
      predmetIdMap = await fetchSeminarGroupIds(studium, obdobi);
    } catch {
      // First attempt failed — wait and retry once. Only report if the
      // retry also fails (caught by the outer try/catch below).
      await new Promise((r) => setTimeout(r, 2000));
      predmetIdMap = await fetchSeminarGroupIds(studium, obdobi);
    }
    if (!cachedData.classmates) cachedData.classmates = {};

    // Build tasks by iterating enrolled subjects and matching their subjectId.
    // Per-subject failures are reported individually only when the group map
    // succeeded (root cause is then the per-subject fetch, not the map).
    const classmateTasks = classmatesDue
      .filter(([, subject]) => subject.subjectId && predmetIdMap[subject.subjectId])
      .map(([courseCode, subject]) =>
        limit(async () => {
          const predmetId = subject.subjectId!;
          // safe: filter above already confirmed predmetIdMap[subject.subjectId] is truthy
          const skupinaId = predmetIdMap[predmetId]!;
          try {
            const data = await fetchClassmates(predmetId, studium!, obdobi!, skupinaId);
            await IndexedDBService.set('classmates', courseCode, data);
            (cachedData.classmates as Record<string, unknown>)[courseCode] = data;
            markFetched(`classmates:${courseCode}`);
            // Persist skupinaId for use in the UI if needed
            // safe: courseCode came from Object.entries(subjectsValue.data) above
            subjectsValue.data[courseCode]!.skupinaId = skupinaId;
          } catch (e) {
            sendToIframe(Messages.telemetryError('SyncService.syncClassmates', e));
          }
        })
      );

    await Promise.all(classmateTasks);
  } catch (e) {
    // Group-map fetch failed twice — single report for the root cause.
    // Per-subject classmate fetches are skipped (no map), so no cascade.
    sendToIframe(Messages.telemetryError('Sync.fetchSeminarGroupIds.retry', e));
  }
}

export async function refreshExams(): Promise<void> {
  const fresh = await fetchDualLanguageExams();
  if (fresh.length > 0) {
    cachedData = { ...cachedData, exams: fresh };
    sendToIframe(Messages.syncUpdate({ exams: fresh, isSyncing, lastSync: cachedData.lastSync }));
  }
}
