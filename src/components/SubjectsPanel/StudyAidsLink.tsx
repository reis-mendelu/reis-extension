import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useStudyAids } from '@/hooks/useStudyAids';
import { trackFeatureSignal } from '@/api/featureUsage';
import { studyAidsIcon } from '../StudyAids/StudyAidsIcon';

/**
 * The links under the subjects for this student's field (mendelu.app's
 * "Studijní opory", their programme's Discord): the extension's half of the
 * phone's StudyAidsRow. One card per link, each `className` apart.
 *
 * Plain `target="_blank"` links: a browser tab is exactly right in a browser.
 * Shown only to the students whose faculty and programme the admin console has
 * picked (each link's `study_aids` row, decided on the device), nothing otherwise.
 *
 * A tap is counted on the install under the link's own label, because whoever
 * runs the site can be told how many installs followed it. The primary click
 * and a middle-click count, never a right-click (`auxclick` fires for the right
 * button too, which only opens the context menu). Nothing about the student
 * goes with the link.
 */
export function StudyAidsLink({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const aids = useStudyAids();
  if (aids.length === 0) return null;

  return (
    <>
      {aids.map((aid) => {
        const Icon = studyAidsIcon(aid.icon);
        return (
          <a
            key={aid.id}
            href={aid.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void trackFeatureSignal(aid.clickSignal)}
            onAuxClick={(e) => {
              if (e.button === 1) void trackFeatureSignal(aid.clickSignal);
            }}
            className={`flex items-center gap-3 rounded-xl border border-base-300 bg-base-100 px-4 py-2.5 transition-colors hover:bg-base-200 ${className}`}
          >
            <Icon className="h-4 w-4 shrink-0 text-base-content/50" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-medium">{t(aid.labelKey)}</span>
              <span className="truncate text-xs text-base-content/70">{t(aid.hintKey)}</span>
            </span>
            <ExternalLink className="h-4 w-4 shrink-0 text-base-content/50" />
          </a>
        );
      })}
    </>
  );
}
