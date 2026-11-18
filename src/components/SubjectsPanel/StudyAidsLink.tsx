import { BookOpen, ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useStudyAids } from '@/hooks/useStudyAids';
import { trackFeatureSignal } from '@/api/featureUsage';

/**
 * "Studijní opory" under the subjects: the study aids on mendelu.app, the
 * extension's half of the phone's StudyAidsRow.
 *
 * A plain `target="_blank"` link: a browser tab is exactly right in a browser.
 * Shown only to the students whose faculty and programme the admin console has
 * picked (the `study_aids` row, decided on the device), nothing otherwise.
 *
 * The tap is counted on the install, because the site's author is told how many
 * installs followed the link. The primary click and a middle-click count, never
 * a right-click (`auxclick` fires for the right button too, which only opens the
 * context menu). Nothing about the student goes with the link.
 */
export function StudyAidsLink({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const aids = useStudyAids();
  if (!aids) return null;

  return (
    <a
      href={aids.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void trackFeatureSignal(aids.clickSignal)}
      onAuxClick={(e) => {
        if (e.button === 1) void trackFeatureSignal(aids.clickSignal);
      }}
      className={`flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 px-4 py-2.5 transition-colors hover:bg-base-200 ${className}`}
    >
      <BookOpen className="h-4 w-4 shrink-0 text-base-content/50" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{t('subjects.studyAids')}</span>
        <span className="truncate text-xs text-base-content/70">{t('subjects.studyAidsHint')}</span>
      </span>
      <ExternalLink className="h-4 w-4 shrink-0 text-base-content/50" />
    </a>
  );
}
