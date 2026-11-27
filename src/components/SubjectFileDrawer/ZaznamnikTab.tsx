import { ExternalLink } from 'lucide-react';
import { useZaznamnik } from '../../hooks/data/useZaznamnik';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { VtTestAttempt } from '../../types/zaznamnik';
import { VtTestGroup } from './Zaznamnik/VtTestGroup';
import { PhArchView } from './Zaznamnik/PhArchView';
import { AttendanceSection } from './Zaznamnik/AttendanceSection';
import { ZaznamnikEmpty } from './Zaznamnik/ZaznamnikEmpty';
import { recordedGroups } from '../../utils/attendanceSummary';
import { ReportMissingLink } from '../Feedback/ReportMissingLink';
import { SubmissionBoxList } from '../SubmissionBoxes/SubmissionBoxList';
import { useOdevzdavarny } from '../../hooks/data/useOdevzdavarny';
import { LoadFailed } from '../LoadFailed';
import { zaznamnikPeriod } from '../../utils/zaznamnik/pastSemester';
import { PersonaUnavailable } from '../Impersonation/PersonaUnavailable';

const IS_BASE = 'https://is.mendelu.cz';

interface ZaznamnikTabProps {
  courseCode: string;
}

export function ZaznamnikTab({ courseCode }: ZaznamnikTabProps) {
  const { data, isLoading, isFailed } = useZaznamnik(courseCode);
  const refetchZaznamnik = useAppStore((s) => s.refetchZaznamnik);
  const impersonating = useAppStore((s) => !!s.impersonation);
  const subjectInfo = useAppStore((s) => (courseCode ? s.subjects?.data[courseCode] : undefined));
  const studium = useAppStore((s) => s.studiumId);
  const obdobi = useAppStore((s) => s.obdobiId);
  const { t, language } = useTranslation();
  const lang = language === 'cz' ? 'cz' : 'en';
  const subjectId = subjectInfo?.subjectId;
  // A past subject lives in IS under the period it was taken in.
  const period = obdobi ? zaznamnikPeriod(subjectInfo, obdobi) : null;
  // Docházka, then submission boxes, sit on top of every state below: both come
  // from their own sync, so a subject can have them before (or without) marks.
  const { assignments: boxes } = useOdevzdavarny(subjectId);
  const hasAttendance = useAppStore(
    (s) => !s.impersonation && recordedGroups(s.attendance[courseCode]).length > 0
  );
  const topSection = (
    <>
      <AttendanceSection courseCode={courseCode} />
      <SubmissionBoxList boxes={boxes} />
    </>
  );
  const hasTop = hasAttendance || boxes.length > 0;

  const buildUrl = (extra: string) =>
    `${IS_BASE}/auth/student/list.pl?studium=${studium};obdobi=${period};predmet=${subjectId};${extra};lang=${lang}`;

  const backlinks =
    (subjectInfo?.hasPrubezne || subjectInfo?.hasTest) && studium && period && subjectId ? (
      <div className="flex flex-wrap justify-center gap-2 pt-2 pb-2">
        {subjectInfo!.hasPrubezne && (
          <a
            href={buildUrl('prubezne=1')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary normal-case font-bold"
          >
            <span>{t('zaznamnik.isContinuous')}</span>
            <ExternalLink size={14} />
          </a>
        )}
        {subjectInfo!.hasTest && (
          <a
            href={buildUrl('test=1')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary normal-case font-bold"
          >
            <span>{t('zaznamnik.isTestResults')}</span>
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    ) : null;

  // Marks are personal in IS, and this store is keyed by subject code: a
  // subject the persona shares with the admin holds the ADMIN's own marks.
  if (impersonating) {
    return (
      <div className="p-4">
        <PersonaUnavailable what="zaznamnik" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 space-y-5 text-[13px]">
        {topSection}
        <div className="space-y-3 animate-pulse">
          <div className="h-4 bg-base-300 rounded w-1/3" />
          <div className="h-10 bg-base-300 rounded" />
          <div className="h-10 bg-base-300 rounded" />
          <div className="h-4 bg-base-300 rounded w-1/4 mt-4" />
          <div className="h-10 bg-base-300 rounded" />
        </div>
      </div>
    );
  }

  // "Could not load" is not "no marks" (Návrhy #26). Docházka and boxes come
  // from their own sync, so they still show above it.
  if (isFailed) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {hasTop && <div className="p-4 pb-0 space-y-5 text-[13px]">{topSection}</div>}
        <LoadFailed
          testId="zaznamnik-error"
          // The same preconditions refetchZaznamnik checks, so the button is
          // never one that does nothing (impersonation returned above).
          onRetry={studium && obdobi && subjectId ? () => refetchZaznamnik(courseCode) : undefined}
        />
        {backlinks}
      </div>
    );
  }

  if (!data || (!data.ph.sections.length && !data.vt.tests.length)) {
    const hasFlags = subjectInfo?.hasPrubezne || subjectInfo?.hasTest;
    // Flags are set only from the current semester's subject list. A subject
    // known only from the document server has none and is never fetched, so
    // reIS cannot say it has no assessment — only that it does not load it.
    const checked = subjectInfo?.hasPrubezne === false && subjectInfo?.hasTest === false;
    // One placeholder where the marks would be, alone or under Docházka and boxes.
    // Neither says whether marks are missing, so the report link stays with it.
    return (
      <div className="h-full overflow-y-auto p-4 space-y-5 text-[13px]">
        {topSection}
        <ZaznamnikEmpty reason={hasFlags ? 'noData' : checked ? 'noAssessment' : 'notLoaded'} />
        {hasFlags && (
          <div className="flex justify-center">
            <ReportMissingLink prefill="zaznamnikEmpty" />
          </div>
        )}
        {backlinks}
      </div>
    );
  }

  const nonEmptyArches = data.ph.sections.flatMap((s) => s.arches.filter((a) => !a.empty));
  const vtTests = data.vt.tests;

  const vtGroups: { name: string; attempts: VtTestAttempt[] }[] = [];
  for (const test of vtTests) {
    const existing = vtGroups.find((g) => g.name === test.name);
    if (existing) existing.attempts.push(test);
    else vtGroups.push({ name: test.name, attempts: [test] });
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5 text-[13px]">
      {topSection}
      <PhArchView sections={data.ph.sections} />

      {vtGroups.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/40">
            {t('zaznamnik.vtSection')} · {vtTests.length}
          </p>
          {vtGroups.map((group, i) => (
            <VtTestGroup key={i} name={group.name} attempts={group.attempts} />
          ))}
        </div>
      )}

      {nonEmptyArches.length === 0 && vtGroups.length === 0 && (
        <div className="space-y-2">
          <ZaznamnikEmpty reason="nothingYet" />
          <div className="flex justify-center">
            <ReportMissingLink prefill="zaznamnikEmpty" />
          </div>
        </div>
      )}

      {backlinks}
    </div>
  );
}
