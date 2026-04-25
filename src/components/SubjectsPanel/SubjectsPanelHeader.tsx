import { useTranslation } from '@/hooks/useTranslation';
import { useUserParams } from '@/hooks/useUserParams';
import type { StudyPlan, StudyStats } from '@/types/studyPlan';
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldAlert, Layers } from 'lucide-react';

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

type ProgressionLevel = 'safe' | 'warning' | 'danger';

function getProgressionInfo(stats: StudyStats): { level: ProgressionLevel; threshold: number; earned: number; deficit: number; enrolledEnough: boolean } {
  if (stats.totalEarnedCredits >= 150) return { level: 'safe', threshold: 0, earned: 0, deficit: 0, enrolledEnough: true };

  const isFirstSemester = stats.previousSemester === null;
  const threshold = isFirstSemester ? 12 : 40;
  const earned = isFirstSemester ? stats.currentSemester.earnedCredits : stats.creditsLastTwoPeriods;
  const deficit = Math.max(0, threshold - earned);
  const available = stats.currentSemester.enrolledCredits;
  const enrolledEnough = available >= deficit;

  if (deficit <= 0) return { level: 'safe', threshold, earned, deficit: 0, enrolledEnough: true };
  if (enrolledEnough) {
    const level = deficit > available * 0.7 ? 'warning' : 'safe';
    return { level, threshold, earned, deficit, enrolledEnough };
  }
  return { level: 'danger', threshold, earned, deficit, enrolledEnough };
}

const levelConfig = {
  safe: { bg: 'bg-success/8', border: 'border-success/20', text: 'text-success', bar: 'bg-success', Icon: CheckCircle2 },
  warning: { bg: 'bg-warning/8', border: 'border-warning/20', text: 'text-warning', bar: 'bg-warning', Icon: AlertTriangle },
  danger: { bg: 'bg-error/8', border: 'border-error/20', text: 'text-error', bar: 'bg-error', Icon: ShieldAlert },
};

export function SubjectsPanelHeader({ creditsAcquired, creditsRequired, studyStats, plan, zameraniProgress, enrolledCredits }: SubjectsPanelHeaderProps) {
  const { t, language } = useTranslation();
  const { params } = useUserParams();
  const studium = params?.studium || '';
  const lang = language === 'cz' ? 'cz' : 'en';
  const registrationsUrl = studium
    ? `https://is.mendelu.cz/auth/student/registrace.pl?studium=${studium};lang=${lang}`
    : `https://is.mendelu.cz/auth/student/registrace.pl?lang=${lang}`;

  const zameraniMin = plan?.zameraniMinimum;
  const zameraniTouched = zameraniProgress ? Array.from(zameraniProgress.values()).filter(p => p.touched).length : 0;

  const pct = creditsRequired > 0 ? Math.min(100, Math.round((creditsAcquired / creditsRequired) * 100)) : 0;
  const progressionInfo = studyStats ? getProgressionInfo(studyStats) : null;
  const level = progressionInfo?.level ?? 'safe';
  const cfg = levelConfig[level];
  const Icon = cfg.Icon;

  // Cross-source reconciliation: studyStats and the parsed plan are independent
  // scrapes. If they disagree on earned credits, the banner should not claim OK.
  const creditsMismatch = plan && studyStats
    ? plan.creditsAcquired !== studyStats.totalEarnedCredits
    : false;

  return (
    <div className="px-4 py-3 border-b border-base-300">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-lg font-semibold shrink-0 truncate" title={plan?.title}>
          {plan?.title || t('subjects.title')}
        </h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <a href={registrationsUrl} target="_blank" rel="noopener noreferrer"
            className="btn btn-ghost btn-sm px-2.5 text-base-content/50 hover:text-primary gap-1.5">
            <span className="text-xs uppercase whitespace-nowrap">{t('sidebar.registrations')}</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>

      {/* Progression Card */}
      <div className={`rounded-lg border px-3.5 py-2.5 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`w-4 h-4 ${cfg.text} shrink-0`} />
          <span className={`text-sm font-semibold ${cfg.text}`}>
            {level === 'safe' ? t('subjects.progressionSafe') :
             level === 'warning' ? t('subjects.progressionWarning') :
             t('subjects.progressionDanger')}
          </span>
          <span className="ml-auto text-xs text-base-content/50 font-medium">
            {creditsAcquired} / {creditsRequired} {t('subjects.credits')}
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-base-content/10 rounded-full overflow-hidden mb-2">
          <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`} style={{ width: `${pct}%` }} />
        </div>

        {/* Detail line */}
        <div className="flex items-center gap-2 text-[11px] text-base-content/50">
          {studyStats && progressionInfo && progressionInfo.threshold > 0 && (
            <span>
              {progressionInfo.threshold === 12
                ? `${progressionInfo.earned}/${progressionInfo.threshold}`
                : `${t('subjects.creditsLastTwo')}: ${progressionInfo.earned}/${progressionInfo.threshold}`
              }
              {progressionInfo.deficit > 0 && (
                <span className={cfg.text}> · {t('subjects.needMore', { n: progressionInfo.deficit })}</span>
              )}
              {!progressionInfo.enrolledEnough && progressionInfo.deficit > 0 && (
                <span className="text-error"> · {t('subjects.notEnoughEnrolled')}</span>
              )}
            </span>
          )}
          <span className="flex items-center gap-2 ml-auto">
            {enrolledCredits != null && enrolledCredits > 0 && (
              <span>{enrolledCredits} {t('subjects.enrolledCreditsLabel')}</span>
            )}
            {studyStats && studyStats.gpaTotal > 0 && (
              <span>{t('subjects.gpa')}: {studyStats.weightedGpaTotal.toFixed(2)}</span>
            )}
          </span>
        </div>

        {zameraniMin !== undefined && zameraniMin > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-base-content/60">
            <Layers className="w-3 h-3 shrink-0" />
            <span>
              {t('subjects.zameraniProgress', { touched: zameraniTouched, min: zameraniMin })}
            </span>
          </div>
        )}

        {creditsMismatch && plan && studyStats && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-warning">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>
              {t('subjects.sourcesMismatch', { plan: plan.creditsAcquired, stats: studyStats.totalEarnedCredits })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
