import { fetchPastSemesterData } from '../../api/subjects';
import { IndexedDBService } from '../storage';
import { sendToIframe } from '../../injector/iframeManager';
import { Messages } from '../../types/messages';
import type { AvailablePeriod, SubjectAttendance, SubjectsData } from '../../types/documents';
import type { SyncedData } from '../../types/messages/base';
import { asksEnglish, type FetchLanguage } from '../../api/fetchLanguage';

const META_KEY_PREFIX = 'past_semester_';

export async function syncPastSemesters(
  studium: string,
  currentObdobi: string,
  allPeriods: AvailablePeriod[],
  lang: FetchLanguage
): Promise<void> {
  const pastPeriods = allPeriods.filter((p) => p.id !== currentObdobi);
  if (pastPeriods.length === 0) return;

  const mergedPastAttendance: Record<string, SubjectAttendance[]> = {};

  for (const period of pastPeriods) {
    const cacheKey = `${META_KEY_PREFIX}${period.id}`;

    // Permanent cache — past semesters are immutable facts. Its names are not:
    // an entry fetched for a Czech student has no English ones, so it is
    // refetched once the student reads in English. An entry with no `lang`
    // predates single-language fetching and holds both.
    const cached = (await IndexedDBService.get('meta', cacheKey)) as
      | {
          subjects: SubjectsData;
          attendance: Record<string, SubjectAttendance[]>;
          lang?: FetchLanguage;
        }
      | undefined;
    const lacksEnglish = !!cached?.lang && !asksEnglish(cached.lang) && asksEnglish(lang);

    let subjects: SubjectsData | null = null;
    let attendance: Record<string, SubjectAttendance[]> = {};

    if (cached?.subjects && cached?.attendance && !lacksEnglish) {
      subjects = cached.subjects;
      attendance = cached.attendance;
    } else {
      const result = await fetchPastSemesterData(studium, period.id, lang);
      if (result) {
        subjects = result.subjects;
        attendance = result.attendance;
        await IndexedDBService.set('meta', cacheKey, { subjects, attendance, lang });
      }
    }

    for (const [code, records] of Object.entries(attendance)) {
      if (mergedPastAttendance[code]) {
        mergedPastAttendance[code] = [...mergedPastAttendance[code], ...records];
      } else {
        mergedPastAttendance[code] = records;
      }
    }
  }

  const update: Partial<SyncedData> = {
    pastAttendance: mergedPastAttendance,
    lastSync: Date.now(),
  };

  sendToIframe(Messages.syncUpdate(update as SyncedData));
}
