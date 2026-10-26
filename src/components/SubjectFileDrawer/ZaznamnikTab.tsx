import { ClipboardList, ExternalLink } from 'lucide-react';
import { useZaznamnik } from '../../hooks/data/useZaznamnik';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import type { VtTestAttempt } from '../../types/zaznamnik';
import { VtTestGroup } from './Zaznamnik/VtTestGroup';
import { PhArchView } from './Zaznamnik/PhArchView';
import { ReportMissingLink } from '../Feedback/ReportMissingLink';
import { SubmissionBoxList } from '../SubmissionBoxes/SubmissionBoxList';
import { useOdevzdavarny } from '../../hooks/data/useOdevzdavarny';
import { LoadFailed } from '../LoadFailed';

const IS_BASE = 'https://is.mendelu.cz';

interface ZaznamnikTabProps {
  courseCode: string;
  /**
   * Off on the phone, where the sheet pins a single IS link in its footer.
   * Defaults to shown so the desktop drawer is untouched — the same contract
   * every sibling tab uses.
   */
  showIsBacklink?: boolean;
}

export function ZaznamnikTab({ courseCode, showIsBacklink = true }: ZaznamnikTabProps) {
  const { data, isLoading, isFailed } = useZaznamnik(courseCode);
  const refetchZaznamnik = useAppStore((s) => s.refetchZaznamnik);
  const impersonating = useAppStore((s) => !!s.impersonation);
  const subjectInfo = useAppStore((s) => (courseCode ? s.subjects?.data[courseCode] : undefined));
  const studium = useAppStore((s) => s.studiumId);
  const obdobi = useAppStore((s) => s.obdobiId);
  const { t, language } = useTranslation();
  const lang = language === 'cz' ? 'cz' : 'en';
  const subjectId = subjectInfo?.subjectId;
  // Submission boxes sit on top of every state below: they come from their own
  // sync, so a subject can have boxes before (or without) any recorded marks.
  const { assignments: boxes } = useOdevzdavarny(subjectId);
  const boxSection = <SubmissionBoxList boxes={boxes} />;

  const buildUrl = (extra: string) =>
    `${IS_BASE}/auth/student/list.pl?studium=${studium};obdobi=${obdobi};predmet=${subjectId};${extra};lang=${lang}`;

  const backlinks =
    showIsBacklink &&
    (subjectInfo?.hasPrubezne || subjectInfo?.hasTest) &&
    studium &&
    obdobi &&
    subjectId ? (
      <div className="flex justify-center gap-2 pt-2 pb-2">
        {subjectInfo!.hasPrubezne && (
          <a
            href={buildUrl('prubezne=1')}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm gap-2 text-base-content/50 hover:text-primary normal-case font-bold"
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
            className="btn btn-ghost btn-sm gap-2 text-base-content/50 hover:text-primary normal-case font-bold"
          >
            <span>{t('zaznamnik.isTestResults')}</span>
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    ) : null;

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 space-y-5 text-[13px]">
        {boxSection}
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

  // "Could not load" is not "no marks" (Návrhy #26). Boxes come from their
  // own sync, so they still show above it.
  if (isFailed) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {boxes.length > 0 && <div className="p-4 pb-0 text-[13px]">{boxSection}</div>}
        <LoadFailed
          testId="zaznamnik-error"
          // The same preconditions refetchZaznamnik checks, so the button is
          // never one that does nothing.
          onRetry={
            !impersonating && studium && obdobi && subjectId
              ? () => refetchZaznamnik(courseCode)
              : undefined
          }
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
    const emptyMessage = hasFlags
      ? t('zaznamnik.noData')
      : checked
        ? t('zaznamnik.noAssessment')
        : t('zaznamnik.notLoaded');
    // With boxes to show, the empty-records note shrinks to a line under them
    // instead of filling the tab as if there were nothing here at all.
    if (boxes.length > 0) {
      return (
        <div className="h-full overflow-y-auto p-4 space-y-5 text-[13px]">
          {boxSection}
          <p className="text-xs text-base-content/70">{emptyMessage}</p>
          {backlinks}
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="flex flex-col items-center opacity-40">
            <ClipboardList className="w-12 h-12 mb-3" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
          {hasFlags && <ReportMissingLink prefill="zaznamnikEmpty" className="mt-2" />}
        </div>
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
      {boxSection}
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
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="flex flex-col items-center opacity-40">
            <ClipboardList className="w-12 h-12 mb-3" />
            <p className="text-sm">{t('zaznamnik.nothingYet')}</p>
          </div>
          <ReportMissingLink prefill="zaznamnikEmpty" className="mt-2" />
        </div>
      )}

      {backlinks}
    </div>
  );
}
