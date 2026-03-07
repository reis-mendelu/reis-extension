import { useTranslation } from '@/hooks/useTranslation';
import { useUserParams } from '@/hooks/useUserParams';
import type { StudyStats } from '@/types/studyPlan';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

interface SubjectsPanelHeaderProps {
  creditsAcquired: number;
  creditsRequired: number;
  studyStats: StudyStats | null;
}

type ProgressionLevel = 'safe' | 'warning' | 'danger';

function getProgressionInfo(stats: StudyStats): { level: ProgressionLevel; threshold: number } {
  if (stats.totalEarnedCredits >= 150) return { level: 'safe', threshold: 0 };

  // First semester: 12-credit minimum (no previous semester exists)
  const isFirstSemester = stats.previousSemester === null;
  const threshold = isFirstSemester ? 12 : 40;
  const earned = isFirstSemester ? stats.currentSemester.earnedCredits : stats.creditsLastTwoPeriods;

  const needed = threshold - earned;
  if (needed <= 0) return { level: 'safe', threshold };
  const available = stats.currentSemester.enrolledCredits;
  if (available >= needed) return { level: needed > available * 0.7 ? 'warning' : 'safe', threshold };
  return { level: 'danger', threshold };
}

export function SubjectsPanelHeader({ creditsAcquired, creditsRequired, studyStats }: SubjectsPanelHeaderProps) {
  const { t, language } = useTranslation();
  const { params } = useUserParams();
  const studium = params?.studium || '';
  const lang = language === 'cz' ? 'cz' : 'en';
  const planCheckUrl = studium
    ? `https://is.mendelu.cz/auth/studijni/studijni_povinnosti.pl?studium=${studium};lang=${lang}`
    : `https://is.mendelu.cz/auth/studijni/studijni_povinnosti.pl?lang=${lang}`;
  const pct = creditsRequired > 0 ? Math.min(100, Math.round((creditsAcquired / creditsRequired) * 100)) : 0;
  const progressionInfo = studyStats ? getProgressionInfo(studyStats) : null;
  const progression = progressionInfo?.level ?? null;

  return (
    <div className="px-4 py-3 border-b border-base-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('subjects.title')}</h2>
        <a
          href={planCheckUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm gap-1.5 text-base-content/50 hover:text-primary"
        >
          <span className="text-xs">IS MENDELU</span>
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 h-2 bg-base-300 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-base-content/60 whitespace-nowrap">
          {creditsAcquired} / {creditsRequired} {t('subjects.credits')}
        </span>
      </div>

      {/* Progression Banner */}
      {progression && studyStats && (
        <div className={`mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium ${
          progression === 'safe' ? 'bg-success/10 text-success' :
          progression === 'warning' ? 'bg-warning/10 text-warning' :
          'bg-error/10 text-error'
        }`}>
          {progression === 'safe' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> :
           <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          <span>
            {progression === 'safe' ? t('subjects.progressionSafe') :
             progression === 'warning' ? t('subjects.progressionWarning') :
             t('subjects.progressionDanger')}
          </span>
          {studyStats.totalEarnedCredits < 150 && progressionInfo && (
            <span className="ml-auto text-base-content/50">
              {progressionInfo.threshold === 12
                ? `${studyStats.currentSemester.earnedCredits}/${progressionInfo.threshold}`
                : `${t('subjects.creditsLastTwo')}: ${studyStats.creditsLastTwoPeriods}/${progressionInfo.threshold}`
              }
            </span>
          )}
        </div>
      )}

      {studyStats && studyStats.gpaTotal > 0 && (
        <div className="mt-1 text-xs text-base-content/50">
          {t('subjects.gpa')}: {studyStats.weightedGpaTotal.toFixed(2)}
        </div>
      )}
    </div>
  );
}
