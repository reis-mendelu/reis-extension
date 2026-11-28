import { ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useViewer } from '../../hooks/useViewer';
import { trackFeatureSignal } from '../../api/featureUsage';
import { isProjectDataAudience, projectDataUrl } from '../../utils/projectData';

/**
 * "Data pro projekt": under an open odevzdávárna of any subject, for the
 * informatics students only, a link to the page with the datasets a project can
 * use (utils/projectData holds who). Rendered inside the
 * shared card, so the extension, phone and iPad all have it. The viewer is the
 * impersonated student while a reis_admin impersonates.
 *
 * A tap is counted on the install (`project_data_opened`): the primary click and
 * a middle-click, never a right-click (`auxclick` fires for it too). Nothing
 * about the student, the subject or the box goes with it.
 */
export function ProjectDataLink() {
  const { t, language } = useTranslation();
  const viewer = useViewer();
  if (!isProjectDataAudience(viewer)) return null;

  const count = () => void trackFeatureSignal('project_data_opened');
  return (
    <a
      data-testid="project-data-link"
      href={projectDataUrl(language)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={count}
      onAuxClick={(e) => {
        if (e.button === 1) count();
      }}
      className="flex items-center gap-1 border-t border-base-content/10 px-3 py-2 text-xs hover:bg-base-200"
    >
      <span className="shrink-0 font-semibold">{t('odevzdavarny.projectData')}</span>
      <span className="min-w-0 truncate text-base-content/70">
        · {t('odevzdavarny.projectDataHint')}
      </span>
      <ExternalLink size={12} aria-hidden className="ml-auto shrink-0 text-base-content/50" />
    </a>
  );
}
