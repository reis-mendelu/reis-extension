import { Mail, MapPin, Phone } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { usePersonProfile } from '../../../hooks/data/usePersonProfile';
import { usePersonPhoto } from '../../../hooks/data/usePersonPhoto';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { resolveRoomCode } from '../../../utils/mobile/resolveRoomCode';
import type { MobileSheet } from '../../../store/types';

type PersonSheetData = Extract<MobileSheet, { kind: 'person' }>;

export interface PersonSheetProps {
  sheet: PersonSheetData;
  onClose: () => void;
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Content-size sheet for a person: photo, what they do, how to reach them, and
 * where to find them.
 *
 * It used to show a name, an email and — for a teacher — nothing else, because
 * the profile parser was written for students and returned nulls for every
 * staff field. IS publishes the work phone, the department, the workplace
 * address and the office on the same page; the parser reads them now.
 *
 * "Where to find them" is the office, not a guess. The previous version showed
 * the room of any lesson the person happened to teach — which is where they
 * are for ninety minutes a week, and misleading the rest of the time. The
 * campus map keys rooms on either the estate code or the friendly name, so
 * both are tried before the button is offered at all: a button that cannot
 * resolve its room is worse than no button.
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
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);

  // Never the raw IS id: the search result that opened this sheet already
  // knows the display name (`personName`), so that's the immediate title —
  // no loading flash. `profile.name` supersedes it once the fetch resolves.
  const name = profile?.name ?? sheet.personName;
  const title =
    name ?? (isLoading ? t('mobile.sheet.personLoading') : t('mobile.sheet.personLoadError'));
  // The role line for staff, the programme for students — whichever this
  // person has.
  const subtitle =
    profile?.roles?.[0] || profile?.studyTypeSentence || profile?.programmeName || undefined;
  const email = profile?.universityEmail || profile?.privateEmail || null;
  const placeholderText = isLoading
    ? t('mobile.sheet.personLoading')
    : error || t('mobile.sheet.personLoadError');

  // The office if the map knows it; otherwise a room they teach in, which is
  // at least somewhere they demonstrably are. Both go through the same
  // resolver so an unknown code never becomes a dead button.
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
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-base-200 font-display text-base font-bold text-primary">
              {photo ? (
                <img src={photo} alt={name} className="h-full w-full object-cover" />
              ) : (
                initials(name)
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-1.5 text-sm text-base-content/70">
              {email && (
                <span className="flex items-center gap-2 truncate">
                  <Mail size={13} className="flex-shrink-0 text-base-content/50" />
                  <span className="truncate">{email}</span>
                </span>
              )}
              {profile?.phone && (
                <span className="flex items-center gap-2 truncate">
                  <Phone size={13} className="flex-shrink-0 text-base-content/50" />
                  <span className="truncate">{profile.phone}</span>
                </span>
              )}
              {room && (
                <span className="flex items-center gap-2 truncate">
                  <MapPin size={13} className="flex-shrink-0 text-base-content/50" />
                  <span className="truncate">{room.label}</span>
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex min-h-11 items-center justify-center rounded-xl bg-primary/15 text-base font-semibold text-primary"
              >
                {t('mobile.sheet.writeEmail')}
              </a>
            )}
            {profile?.phone && (
              <a
                href={`tel:${profile.phone.replace(/\s/g, '')}`}
                className="flex min-h-11 items-center justify-center rounded-xl border border-base-300 text-base font-semibold text-base-content/70"
              >
                {t('mobile.sheet.callPerson')}
              </a>
            )}
            {room && (
              <button
                type="button"
                onClick={onShowOnMap}
                className="flex min-h-11 items-center justify-center rounded-xl border border-base-300 text-base font-semibold text-base-content/70"
              >
                {t('mobile.sheet.navigateToRoom', { room: room.label })}
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
