import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { PersonContactRows } from './PersonContactRows';
import { usePersonProfile } from '../../../hooks/data/usePersonProfile';
import { usePersonPhoto } from '../../../hooks/data/usePersonPhoto';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { openTeamsChat } from '../../../mobile/teamsLink';
import { TEAMS_ICON_PATH } from '../../../constants/icons';
import { resolveRoomCode } from '../../../utils/mobile/resolveRoomCode';
import { personInitials } from '../../../utils/mobile/personInitials';
import type { MobileSheet } from '../../../store/types';

type PersonSheetData = Extract<MobileSheet, { kind: 'person' }>;

export interface PersonSheetProps {
  sheet: PersonSheetData;
  onClose: () => void;
}

/**
 * Content-size sheet for a person: who they are, how to reach them, and — for
 * staff — where to find them.
 *
 * Four things, and no fifth. The work phone IS publishes is gone: nobody rings
 * a lecturer, and on a phone-sized sheet an unused row costs more than it
 * gives. What is left is what a student actually does — read the name, take the
 * address, message them on Teams, walk to the office.
 *
 * The email is a COPY control rather than a mailto: link. A mailto: hands the
 * student to whichever mail app the OS picked years ago; the address on the
 * clipboard works in Outlook, in Teams, in a form — wherever they were going.
 *
 * "Where to find them" is the office, not a guess. The previous version showed
 * the room of any lesson the person happened to teach — which is where they
 * are for ninety minutes a week, and misleading the rest of the time. The
 * campus map keys rooms on either the estate code or the friendly name, so
 * both are tried before the row is offered at all: a control that cannot
 * resolve its room is worse than none.
 */
export function PersonSheet({ sheet, onClose }: PersonSheetProps) {
  const { t } = useTranslation();
  const numericId = Number(sheet.personId);
  const { profile, isLoading, error } = usePersonProfile(
    Number.isFinite(numericId) ? numericId : undefined
  );
  const photo = usePersonPhoto(sheet.personId);
  const { schedule } = useSchedule();
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);

  // Never the raw IS id: the search result that opened this sheet already
  // knows the display name (`personName`), so that's the immediate title —
  // no loading flash. `profile.name` supersedes it once the fetch resolves.
  const name = profile?.name ?? sheet.personName;
  const title =
    name ?? (isLoading ? t('mobile.sheet.personLoading') : t('mobile.sheet.personLoadError'));
  // The role line for staff, the programme for students — whichever this
  // person has.
  const subtitle = profile?.roles?.[0] || profile?.programmeName || undefined;
  // What kind of student they are, under the programme in the header. Staff
  // have neither line, which is why this collapses to nothing rather than
  // reserving space for it.
  const studyLines = [profile?.studyTypeSentence, profile?.yearSemesterSentence].filter(
    (line): line is string => Boolean(line)
  );
  const email = profile?.universityEmail || profile?.privateEmail || null;
  // Teams is the university tenant: only a mendelu.cz address resolves to a
  // person there, so a profile with nothing but a private email gets the copy
  // row and no Teams button rather than a button that opens an empty search.
  const teamsEmail = profile?.universityEmail || null;
  const placeholderText = isLoading
    ? t('mobile.sheet.personLoading')
    : error || t('mobile.sheet.personLoadError');

  // The office if the map knows it; otherwise a room they teach in, which is
  // at least somewhere they demonstrably are. Both go through the same
  // resolver so an unknown code never becomes a dead control.
  const taughtRoom = schedule.find((l) =>
    l.teachers.some((teacher) => teacher.id === sheet.personId)
  )?.room;
  const room = resolveRoomCode([profile?.officeCode, profile?.officeName, taughtRoom]);

  const onShowOnMap = () => {
    if (!room) return;
    setMobileTab('map');
    focusRoomByCode(room.code);
  };

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={title} subtitle={subtitle} onClose={onClose} />
      {!name ? (
        <p className="px-5 pb-5 text-sm text-base-content/60">{placeholderText}</p>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-5">
          <div className="flex items-center gap-3">
            {/* A button only once there is a photo to maximise: initials blown
                up to full screen are a joke at the student's expense. */}
            <button
              type="button"
              disabled={!photo}
              aria-label={photo ? t('mobile.sheet.enlargePhoto') : undefined}
              onClick={() =>
                photo && pushSheet({ kind: 'personPhoto', personId: sheet.personId, name })
              }
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-base-200 font-display text-base font-bold text-primary"
            >
              {photo ? (
                <img src={photo} alt={name} className="h-full w-full object-cover" />
              ) : (
                personInitials(name)
              )}
            </button>
            {studyLines.length > 0 && (
              <div className="flex min-w-0 flex-col gap-0.5 text-sm leading-snug text-base-content/70">
                {studyLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
            )}
          </div>

          <PersonContactRows email={email} room={room} onShowOnMap={onShowOnMap} />

          {teamsEmail && (
            <button
              type="button"
              onClick={() => openTeamsChat(teamsEmail)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary/15 text-base font-semibold text-primary"
            >
              {/* The real Teams mark, not a generic speech bubble: the button
                  leaves the app, and the student should know where to. */}
              <img src={TEAMS_ICON_PATH} alt="" className="h-5 w-5" />
              {t('mobile.sheet.teamsChat')}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
