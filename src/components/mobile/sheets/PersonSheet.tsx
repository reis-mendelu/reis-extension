import { Mail, MapPin } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { usePersonProfile } from '../../../hooks/data/usePersonProfile';
import { usePersonPhoto } from '../../../hooks/data/usePersonPhoto';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import type { MobileSheet } from '../../../store/types';

type PersonSheetData = Extract<MobileSheet, { kind: 'person' }>;

export interface PersonSheetProps {
    sheet: PersonSheetData;
    onClose: () => void;
}

function initials(name: string): string {
    return name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * Content-size sheet for a person (teacher/classmate): photo, role, email
 * and a "show on map" jump.
 *
 * IS's parsed profile (`api/personProfile`) has no office field to show a
 * real "kancelář" — the closest available real signal for "where to find
 * this person" is a lesson they actually teach, resolved from the schedule
 * already in the store. The map action reuses `CalendarScreen`'s own
 * mechanism exactly (`setMobileTab('map')` + `focusRoomByCode`, including
 * stripping the trailing "(Campus)" suffix) rather than inventing a second
 * one; `setMobileTab` already clears the whole sheet stack.
 */
export function PersonSheet({ sheet, onClose }: PersonSheetProps) {
    const { t } = useTranslation();
    const numericId = Number(sheet.personId);
    const { profile, isLoading, error } = usePersonProfile(Number.isFinite(numericId) ? numericId : undefined);
    const photo = usePersonPhoto(sheet.personId);
    const { schedule } = useSchedule();
    const setMobileTab = useAppStore((s) => s.setMobileTab);
    const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);

    const taughtLesson = schedule.find((l) => l.teachers.some((teacher) => teacher.id === sheet.personId));
    const roomLabel = taughtLesson?.room;

    // Never the raw IS id: the search result that opened this sheet already
    // knows the display name (`personName`), so that's the immediate title —
    // no loading flash. `profile.name` supersedes it once the fetch resolves.
    // If neither is available, show an explicit loading/error state instead
    // (never falling back to `sheet.personId`).
    const name = profile?.name ?? sheet.personName;
    const title = name ?? (isLoading ? t('mobile.sheet.personLoading') : t('mobile.sheet.personLoadError'));
    const roleLine = profile?.studyTypeSentence || profile?.programmeName || undefined;
    const email = profile?.universityEmail || profile?.privateEmail || null;
    const placeholderText = isLoading ? t('mobile.sheet.personLoading') : error || t('mobile.sheet.personLoadError');

    const onShowOnMap = () => {
        if (!taughtLesson) return;
        const roomCode = taughtLesson.room.replace(/\s*\([^)]*\)\s*$/, '').trim();
        setMobileTab('map');
        focusRoomByCode(roomCode);
    };

    return (
        <Sheet size="content" onClose={onClose}>
            <SheetHeader title={title} subtitle={roleLine} onClose={onClose} />
            {!name ? (
                <p className="px-5 pb-5 text-xs text-base-content/60">{placeholderText}</p>
            ) : (
                <div className="flex flex-col gap-3 px-4 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-base-200 font-display text-sm font-bold text-primary">
                            {photo ? <img src={photo} alt={name} className="h-full w-full object-cover" /> : initials(name)}
                        </div>
                        <div className="flex min-w-0 flex-col gap-1.5 text-xs text-base-content/70">
                            {email && (
                                <span className="flex items-center gap-2 truncate">
                                    <Mail size={13} className="flex-shrink-0 text-base-content/50" />
                                    <span className="truncate">{email}</span>
                                </span>
                            )}
                            {roomLabel && (
                                <span className="flex items-center gap-2 truncate">
                                    <MapPin size={13} className="flex-shrink-0 text-base-content/50" />
                                    <span className="truncate">{roomLabel}</span>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        {email && (
                            <a
                                href={`mailto:${email}`}
                                className="flex min-h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-content"
                            >
                                {t('mobile.sheet.writeEmail')}
                            </a>
                        )}
                        {taughtLesson && (
                            <button
                                type="button"
                                onClick={onShowOnMap}
                                className="flex min-h-11 items-center justify-center rounded-xl border border-base-300 text-sm font-semibold text-base-content/70"
                            >
                                {t('mobile.sheet.showOfficeOnMap')}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </Sheet>
    );
}
