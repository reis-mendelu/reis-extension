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
  const hasDetailLine = (studyStats && progressionInfo && progressionInfo.threshold > 0) ||
    (enrolledCredits != null && enrolledCredits > 0);
  const level = progressionInfo?.level ?? 'safe';
  const cfg = levelConfig[level];
  const Icon = cfg.Icon;

  return (
    <div className="px-4 py-2.5 border-b border-base-300 shrink-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h2 className="text-base font-semibold shrink-0 truncate" title={plan?.title}>
          {plan?.title || t('subjects.title')}
        </h2>
        <a href={registrationsUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 bg-base-200/30 border border-base-300/50 rounded-lg shadow-sm hover:bg-base-200/50 transition-colors shrink-0">
          <span className="text-[11px] text-base-content/40 font-medium uppercase tracking-wider">{t('sidebar.registrations')}</span>
          <ExternalLink size={13} className="text-base-content/40 shrink-0" />
        </a>
      </div>

      <div className={`rounded-lg border px-3.5 py-2 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <Icon className={`w-4 h-4 ${cfg.text} shrink-0`} />
          <span className={`text-sm font-semibold ${cfg.text}`}>
            {level === 'safe' ? t('subjects.progressionSafe') :
             level === 'warning' ? t('subjects.progressionWarning') :
             t('subjects.progressionDanger')}
          </span>
          <span className="ml-auto text-xs text-base-content/50 font-medium">
            {creditsAcquired} / {creditsRequired}<span className="hidden md:inline"> {t('subjects.credits')}</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-base-content/10 rounded-full overflow-hidden mb-1.5">
          <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`} style={{ width: `${pct}%` }} />
        </div>

        {/* Detail / zaměření line */}
        {(hasDetailLine || (zameraniMin !== undefined && zameraniMin > 0)) && (
          <div className="flex items-center gap-2 text-[11px] text-base-content/50 mt-1">
            {zameraniMin !== undefined && zameraniMin > 0 ? (
              <span className="flex items-center gap-1.5 text-[10px] text-base-content/60">
                <Layers className="w-3 h-3 shrink-0" />
                <span className="md:hidden">{zameraniTouched} / {zameraniMin}</span>
                <span className="hidden md:inline">{t('subjects.zameraniProgress', { touched: zameraniTouched, min: zameraniMin })}</span>
              </span>
            ) : (studyStats && progressionInfo && progressionInfo.threshold > 0) ? (
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
            ) : null}
            <span className="flex items-center gap-2 ml-auto">
              {enrolledCredits != null && enrolledCredits > 0 && (
                <span>{enrolledCredits} {t('subjects.enrolledCreditsLabel')}</span>
              )}
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
