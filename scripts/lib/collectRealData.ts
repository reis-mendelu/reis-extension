import pLimit from 'p-limit';
import type { SyncedData } from '@/types/messages';
import { getUserParams } from '@/utils/userParams';
import { fetchFullSemesterSchedule } from '@/injector/dataFetchers';
import { fetchDualLanguageExams } from '@/api/exams';
import { fetchDualLanguageSubjects } from '@/api/subjects';
import { fetchDualLanguagePastSubjects } from '@/api/pastSubjects';
import { fetchDualLanguageStudyPlan } from '@/api/studyPlan';
import { fetchStudyStats } from '@/api/studyStats';
import { fetchStudyComparison } from '@/api/studyComparison';
import { syncCvicneTests } from '@/services/sync/syncCvicneTests';
import { syncOdevzdavarny } from '@/services/sync/syncOdevzdavarny';
import { mergePastSubjects } from '@/services/sync/mergePastSubjects';
import { fetchFilesFromFolder } from '@/api/documents';
import { fetchSyllabus } from '@/api/syllabus';
import { syncZaznamnik } from '@/services/sync/syncZaznamnik';
import { fetchSeminarGroupIds, fetchClassmates } from '@/api/classmates';

const limit = pLimit(3);
const log = (m: string) => process.stderr.write(`[collect] ${m}\n`);
const val = <T>(r: PromiseSettledResult<T>): T | undefined =>
  r.status === 'fulfilled' ? r.value : undefined;

type SubjectInfo = {
  folderUrl?: string;
  subjectId?: string;
  skupinaId?: string;
  hasPrubezne?: boolean;
  hasTest?: boolean;
};

export async function collectRealData(): Promise<SyncedData> {
  const params = await getUserParams();
  const studium = params?.studium;
  const obdobi = params?.obdobi;
  log(`userParams studium=${studium} obdobi=${obdobi}`);

  const [
    schedule,
    exams,
    subjectsRes,
    studyPlan,
    studyStats,
    studyComparison,
    cvicne,
    odev,
    pastSubjects,
  ] = await Promise.allSettled([
    fetchFullSemesterSchedule(),
    fetchDualLanguageExams(),
    fetchDualLanguageSubjects(studium || undefined, obdobi || undefined),
    studium ? fetchDualLanguageStudyPlan(studium) : Promise.resolve(null),
    studium && obdobi ? fetchStudyStats(studium, obdobi) : Promise.resolve(null),
    studium && obdobi ? fetchStudyComparison(studium, obdobi) : Promise.resolve(null),
    studium ? syncCvicneTests(studium) : Promise.resolve(null),
    studium && obdobi ? syncOdevzdavarny(studium, obdobi) : Promise.resolve(null),
    fetchDualLanguagePastSubjects(),
  ]);

  const subjects = val(subjectsRes) ?? null;
  const past = val(pastSubjects);
  if (subjects && past) {
    mergePastSubjects(subjects.subjects, past, val(studyPlan) ?? null);
  }

  const examsVal = val(exams);
  const data: SyncedData = {
    schedule: val(schedule) ?? undefined,
    exams: examsVal && examsVal.length ? examsVal : undefined,
    subjects: subjects?.subjects,
    attendance: subjects?.attendance as Record<string, unknown> | undefined,
    studyPlan: val(studyPlan) ?? undefined,
    studyStats: val(studyStats) ?? undefined,
    studyComparison: val(studyComparison) ?? undefined,
    cvicneTests: val(cvicne)?.tests,
    odevzdavarny: val(odev)?.assignments,
    files: {},
    syllabuses: {},
    lastSync: Date.now(),
  };

  if (subjects) {
    await collectSubjectDetails(data, subjects.subjects, studium, obdobi);
  }
  data.lastSync = Date.now();
  return data;
}

async function collectSubjectDetails(
  data: SyncedData,
  subjectsValue: { data: Record<string, SubjectInfo> },
  studium?: string,
  obdobi?: string
): Promise<void> {
  const entries = Object.entries(subjectsValue.data);
  const files = data.files as Record<string, unknown>;
  const syllabuses = data.syllabuses as Record<string, unknown>;

  const tasks = entries.map(([code, s]) =>
    limit(async () => {
      const jobs: Promise<void>[] = [];
      if (s.folderUrl)
        jobs.push(
          fetchFilesFromFolder(s.folderUrl)
            .then((f) => {
              files[code] = f;
            })
            .catch((e) => log(`files[${code}] failed: ${e instanceof Error ? e.message : e}`))
        );
      if (s.subjectId)
        jobs.push(
          fetchSyllabus(s.subjectId)
            .then((y) => {
              syllabuses[code] = y;
            })
            .catch((e) => log(`syllabus[${code}] failed: ${e instanceof Error ? e.message : e}`))
        );
      await Promise.all(jobs);
    })
  );

  const zaznamnik =
    studium && obdobi
      ? syncZaznamnik(
          studium,
          obdobi,
          entries.map(([courseCode, s]) => ({
            courseCode,
            subjectId: s.subjectId ?? '',
            hasPrubezne: s.hasPrubezne,
            hasTest: s.hasTest,
          }))
        )
          .then((z) => {
            data.zaznamnik = z;
          })
          .catch((e) => log(`zaznamnik failed: ${e instanceof Error ? e.message : e}`))
      : Promise.resolve();

  await Promise.all([...tasks, zaznamnik]);

  if (!studium || !obdobi) return;
  try {
    const predmetIdMap = await fetchSeminarGroupIds(studium, obdobi);
    const classmates: Record<string, unknown> = {};
    const cmTasks = entries
      .filter(([, s]) => s.subjectId && predmetIdMap[s.subjectId])
      .map(([courseCode, s]) =>
        limit(async () => {
          const skupinaId = predmetIdMap[s.subjectId!]!;
          try {
            classmates[courseCode] = await fetchClassmates(
              s.subjectId!,
              studium,
              obdobi,
              skupinaId
            );
          } catch {
            /* per-subject classmate failure is non-fatal */
          }
        })
      );
    await Promise.all(cmTasks);
    data.classmates = classmates;
  } catch {
    /* group-map failure is non-fatal */
  }
}
