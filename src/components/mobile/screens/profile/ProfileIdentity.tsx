import { User } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { usePersonPhoto } from '../../../../hooks/data/usePersonPhoto';
import { useTranslation } from '../../../../hooks/useTranslation';
import { personInitials } from '../../../../utils/mobile/personInitials';

/**
 * Who the Profile tab belongs to: the student's own photo, name and ID, in a
 * full-width block under the header.
 */
export function ProfileIdentity() {
  const { t } = useTranslation();
  const fullName = useAppStore((s) => s.fullName);
  const studentId = useAppStore((s) => s.studentId);
  const pushSheet = useAppStore((s) => s.pushSheet);
  // `studentId` is IS's "Identifikační číslo uživatele", the same id space
  // `foto.pl` takes for everyone else, so the existing authenticated fetch
  // covers the student's own face with no new endpoint.
  const photo = usePersonPhoto(studentId);

  const name = fullName ?? '';

  return (
    <div className="flex-shrink-0">
      <div className="flex items-center gap-3 px-4 pb-3 pt-1">
        {/* Tapping the photo opens the same lightbox a classmate's photo does,
            through the sheet stack, so Android's back closes it and leaves this
            tab as it was. A button only once there is a photo — PersonSheet's
            rule: initials blown up to full screen are nothing to look at. They
            stay as the fallback while it loads or when there is no picture. */}
        <button
          type="button"
          disabled={!photo}
          aria-label={photo ? t('mobile.sheet.enlargePhoto') : undefined}
          onClick={() =>
            photo && studentId && pushSheet({ kind: 'personPhoto', personId: studentId, name })
          }
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-base-200 font-display text-base font-bold text-[var(--tone-primary)]"
        >
          {photo ? (
            <img src={photo} alt={name} className="h-full w-full object-cover" />
          ) : name ? (
            personInitials(name)
          ) : (
            <User size={18} />
          )}
        </button>
        {/* No close button: this is a tab, not a sheet — the nav is how you
            leave.

            The name WRAPS rather than truncating. At 320px "Marie Anna
            Nováková-Svobodová" needs 287px in a 232px slot, and losing
            "-Svobodová" is worse than a second line — it is the half that
            tells two siblings apart. */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-display text-lg font-bold leading-tight tracking-tight">
            {name}
          </span>
          {/* The student ID and nothing else under the name. This row used to
              carry the study plan's title ("B-F prez - ZS 2025/2026", or a
              literal "Study Plan" when `extractPlanTitle` found no heading) —
              a fact about the plan, which the Předměty tab already owns.
              The ID is the number every office, form and exam sheet asks for.
              `select-all` so a long-press copies the whole number rather than
              a fragment of it. */}
          {studentId && (
            <span className="select-all text-sm tabular-nums text-base-content/60">
              ID {studentId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
