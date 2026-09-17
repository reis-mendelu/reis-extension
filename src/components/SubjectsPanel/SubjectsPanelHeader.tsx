import { useTranslation } from '@/hooks/useTranslation';
import { useUserParams } from '@/hooks/useUserParams';
import type { StudyPlan, StudyStats } from '@/types/studyPlan';
import { GraduationCap, Layers, ClipboardList, Star, type LucideIcon } from 'lucide-react';
import { Fragment } from 'react';

export interface ZameraniProgress {
  enrolled: number;
  fulfilled: number;
  total: number;
  touched: boolean;
}

interface SubjectsPanelHeaderProps {
  creditsAcquired: number;
  creditsRequired: number;
  studyStats: StudyStats | null;
  plan: StudyPlan | null;
  zameraniProgress?: Map<string, ZameraniProgress>;
  enrolledCredits?: number;
}

/**
 * No progression verdict here any more, and no threshold.
 *
 * This card used to judge a student against 12 credits in a first semester and
 * 40 over the last two, hardcoded, and paint itself green, amber or red on the
 * answer. Those are PEF's numbers: "kámoš ze zahradnické fakulty má minimum 15
 * kreditů, lidi z PEF mají minimum 12". IS's own pruchod_studiem.pl publishes
 * the COUNTS and never the minimum (see api/studyStats — every field there is a
 * "Počet…"), so there is no per-faculty source to read one from, and a green
 * "Studium v pořádku" shown to a student who is actually a credit short is the
 * worst kind of wrong: confident, and about the thing that ends a degree.
 *
 * So the card reports and stops judging. Credits earned, credits enrolled,
 * progress against the plan's own requirement — all of them IS's numbers — and
 * the student takes their faculty's rule from their faculty.
 */

/**
 * Build an IS Mendelu student-section URL, degrading to the studium-less form
 * when user params haven't resolved yet (IS then falls back to the active study).
 */
function isStudentUrl(script: string, studium: string, lang: string): string {
  const studiumPart = studium ? `studium=${studium};` : '';
  return `https://is.mendelu.cz/auth/student/${script}?${studiumPart}lang=${lang}`;
}

interface ISShortcut {
  href: string;
  /** Full name, e.g. "Evaluace předmětů" — the accessible name and tooltip. */
  label: string;
  /** Visible text. Drops the redundant "předmětů": the panel already says it. */
  short: string;
  Icon: LucideIcon;
}

/**
 * The two IS pages that belong to this panel, as one segmented control.
 *
 * Deliberately a single bordered group rather than two buttons: these are escape
 * hatches out to the legacy IS, so they should read as one quiet object instead
 * of two controls competing with the study-plan title and the progress card.
 *
 * Labels collapse below `md`, leaving the icons — which is why each shortcut gets
 * a distinct one rather than a shared external-link glyph. The full name stays in
 * aria-label/title so the icon-only state is still identifiable.
 *
 * That collapse also shrinks the hit area to the glyph, so below `md` each link
 * gets extra horizontal padding and a `min-h-9` floor. Still short of the 44px
 * touch-target guideline, but a compact panel header can't absorb 44px without
 * pushing the study-plan title around.
 */
function ISShortcutGroup({ items }: { items: ISShortcut[] }) {
  return (
    <div className="flex items-stretch shrink-0 overflow-hidden rounded-md border border-primary/25">
      {items.map(({ href, label, short, Icon }, i) => (
        <Fragment key={href}>
          {i > 0 && <span className="w-px bg-primary/20" aria-hidden="true" />}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            title={label}
            className="flex items-center justify-center gap-1.5 min-h-9 px-3.5 md:min-h-0 md:px-2.5 md:py-1.5 text-xs text-base-content/75 hover:bg-primary/10 transition-colors"
          >
            <Icon size={15} className="text-primary shrink-0" />
            <span className="hidden md:inline whitespace-nowrap">{short}</span>
          </a>
        </Fragment>
      ))}
    </div>
  );
}

export function SubjectsPanelHeader({
  creditsAcquired,
  creditsRequired,
  studyStats,
  plan,
  zameraniProgress,
  enrolledCredits,
}: SubjectsPanelHeaderProps) {
  const { t, language } = useTranslation();
  const { params } = useUserParams();
  const studium = params?.studium || '';
  const lang = language === 'cz' ? 'cz' : 'en';
  const registrationsUrl = isStudentUrl('registrace.pl', studium, lang);
  // Same page as the `evaluace-predmetu` nav entry (data/pages/moje-studium-part2.ts).
  const evaluationUrl = isStudentUrl('vyplneni_ankety.pl', studium, lang);

  const zameraniMin = plan?.zameraniMinimum;
  const zameraniTouched = zameraniProgress
    ? Array.from(zameraniProgress.values()).filter((p) => p.touched).length
    : 0;

  const pct =
    creditsRequired > 0 ? Math.min(100, Math.round((creditsAcquired / creditsRequired) * 100)) : 0;
  const lastTwoPeriods = studyStats?.creditsLastTwoPeriods ?? null;
  const hasDetailLine =
    (lastTwoPeriods != null && lastTwoPeriods > 0) ||
    (enrolledCredits != null && enrolledCredits > 0);

  return (
    <div className="px-4 py-2.5 border-b border-base-300 shrink-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        {/* min-w-0 (not shrink-0) so `truncate` can actually engage — with shrink-0
            the title keeps its full width and overflows the row instead of eliding. */}
        <h2 className="text-base font-semibold min-w-0 truncate" title={plan?.title}>
          {plan?.title || t('subjects.title')}
        </h2>
        <ISShortcutGroup
          items={[
            {
              href: registrationsUrl,
              label: t('sidebar.registrations'),
              short: t('subjects.registrationsShort'),
              Icon: ClipboardList,
            },
            {
              href: evaluationUrl,
              label: t('sidebar.evaluation'),
              short: t('subjects.evaluationShort'),
              Icon: Star,
            },
          ]}
        />
      </div>

      <div className="rounded-lg border border-base-300 bg-base-200/60 px-3.5 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <GraduationCap className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">{t('subjects.creditsTitle')}</span>
          <span className="ml-auto text-xs text-base-content/70 font-medium">
            {creditsAcquired} / {creditsRequired}
            <span className="hidden md:inline"> {t('subjects.credits')}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-base-content/10 rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Detail / zaměření line */}
        {(hasDetailLine || (zameraniMin !== undefined && zameraniMin > 0)) && (
          <div className="flex items-center gap-2 text-[11px] text-base-content/70 mt-1">
            {zameraniMin !== undefined && zameraniMin > 0 ? (
              <span className="flex items-center gap-1.5 text-[10px] text-base-content/75">
                <Layers className="w-3 h-3 shrink-0" />
                <span className="md:hidden">
                  {zameraniTouched} / {zameraniMin}
                </span>
                <span className="hidden md:inline">
                  {t('subjects.zameraniProgress', { touched: zameraniTouched, min: zameraniMin })}
                </span>
              </span>
            ) : lastTwoPeriods != null && lastTwoPeriods > 0 ? (
              // The count, with no denominator: IS publishes how many credits
              // the last two periods earned and not how many they had to.
              <span>
                {t('subjects.creditsLastTwo')}: {lastTwoPeriods}
              </span>
            ) : null}
            <span className="flex items-center gap-2 ml-auto">
              {enrolledCredits != null && enrolledCredits > 0 && (
                <span>
                  {enrolledCredits} {t('subjects.enrolledCreditsLabel')}
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
