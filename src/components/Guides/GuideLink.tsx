import { useTranslation } from '../../hooks/useTranslation';
import { currentSchool } from '../../utils/school';
import { guideUrl, type Guide, type GuideSection } from '../../utils/guideUrl';

export interface GuideLinkProps {
  guide: Guide;
  /** Also the label: `troubleshoot` asks "Proč to nejde?", `official` offers "Jiný postup". */
  section: GuideSection;
  /** The surface's own type size and spacing. */
  className?: string;
}

/**
 * A way out at a moment the student is stuck: the reisapp.cz guide section for
 * it. Shared by both trees. A plain `target="_blank"` anchor, so the extension
 * opens a tab and the phone's installExternalLinkHandler opens its in-app
 * browser — no open logic of its own.
 *
 * stopPropagation because some hosts are clickable themselves (a term tile).
 * MENDELU only: the guides describe MENDELU's IS, eduroam and ISIC.
 */
export function GuideLink({ guide, section, className = '' }: GuideLinkProps) {
  const { t, language } = useTranslation();
  if (!currentSchool.has('guides')) return null;
  return (
    <a
      href={guideUrl(guide, language, section)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`link font-semibold ${className}`}
    >
      {t(section === 'troubleshoot' ? 'guides.troubleshoot' : 'guides.official')}
    </a>
  );
}
