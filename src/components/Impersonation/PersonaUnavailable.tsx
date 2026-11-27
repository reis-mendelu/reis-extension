import { UserCog } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

/** The views IS fills only for the signed-in student, so a persona never can. */
export type PersonaUnavailableWhat = 'exams' | 'files' | 'zaznamnik' | 'averagesAndBoxes';

/**
 * Stands in for a view's empty state while an admin impersonates a student.
 * IS gives exams, marks, files, averages and submission boxes only to the
 * student signed in, so a persona has none; the plain empty state ("no exams")
 * looked like a real student with nothing, and admins took our gap for a bug.
 * No report link on purpose: there is nothing to report.
 *
 * Shared by both trees. Same tone as ImpersonationBanner, ink on the tint.
 */
export function PersonaUnavailable({
  what,
  className = '',
}: {
  what: PersonaUnavailableWhat;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="note"
      data-testid="persona-unavailable"
      className={`flex items-start gap-2 rounded-xl border border-info/40 bg-info/10 px-3 py-2 text-xs text-base-content ${className}`}
    >
      <UserCog size={14} className="mt-px flex-shrink-0 text-base-content/70" aria-hidden />
      <span>
        {t('impersonation.unavailable', { what: t(`impersonation.unavailableWhat.${what}`) })}
      </span>
    </div>
  );
}
