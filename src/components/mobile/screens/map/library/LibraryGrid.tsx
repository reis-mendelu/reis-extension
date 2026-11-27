import type { ReactNode } from 'react';
import { CircleCheck, Plus, User, Users } from 'lucide-react';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { LIBRARY_ROOMS, type LibraryRoom } from '../../../../../data/map/libraryRooms';
import type { CellState, GridPick, GridRow } from '../../../../../mobile/library/libraryGrid';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** A column head is 36 px wide at 320 px, so the room's name is cut to what tells them apart. */
const SHORT: Record<number, { cz: string; en: string }> = {
  57621: { cz: 'Ind. 1', en: 'Ind. 1' },
  57625: { cz: 'Ind. 2', en: 'Ind. 2' },
  57632: { cz: 'Tým 1', en: 'Team 1' },
  57627: { cz: 'Tým 2', en: 'Team 2' },
  57640: { cz: 'IC L', en: 'IC L' },
  576401: { cz: 'IC P', en: 'IC R' },
};
const shortName = (r: LibraryRoom, lang: 'cz' | 'en') =>
  SHORT[r.featureId]?.[lang] ?? (lang === 'cz' ? r.nameCs : r.nameEn);

const COLS = 'grid-cols-[2.5rem_repeat(6,minmax(0,1fr))]';

/**
 * The day as a table: one column per room, one row per hour that can still be
 * booked. A free cell is a tap; the pick is one room and a run of hours, and the
 * free cells right above and below it show a "+" (a tap on one adds that hour).
 * No legend: green is free, grey is gone, the student's own booking has a check.
 */
export function LibraryGrid({
  rows,
  pick,
  grow,
  chosen,
  flush,
  bar,
  onTap,
}: {
  rows: GridRow[];
  pick: GridPick | null;
  /** Hours that show a "+" in the picked room. */
  grow: readonly number[];
  /** A room the card was opened on (search, the plan, a booking): its head is marked. */
  chosen: number | null;
  /** In the iPad's rail (a white panel) rather than the phone's sheet (the page tone). */
  flush?: boolean;
  /** What is picked and the button that books it. It sticks under the column heads, so it never covers a cell. */
  bar?: ReactNode;
  onTap: (room: number, hour: number) => void;
}) {
  const { t, language } = useTranslation();
  return (
    <div role="group" aria-label={t('mobile.library.pickHour')} className="space-y-1">
      <div
        // The phone's sheet scrolls under a pt-2 and sticks at its inner edge: the head reaches
        // up over that padding (-top-2) and down over the row gap, so no row shows around it.
        className={`sticky z-10 -mb-1 pb-2 ${flush ? 'top-0 bg-base-100 pt-1' : '-top-2 bg-base-200 pt-3'}`}
      >
        <div className={`grid ${COLS} gap-1`}>
          <span />
          {LIBRARY_ROOMS.map((r) => (
            <div
              key={r.featureId}
              className={`flex flex-col items-center gap-0.5 rounded-md py-0.5 text-[11px] font-semibold leading-tight ${
                r.featureId === chosen || r.featureId === pick?.room
                  ? 'bg-primary text-primary-content'
                  : 'text-base-content/80'
              }`}
            >
              <span className="whitespace-nowrap">{shortName(r, language)}</span>
              <span className="flex items-center gap-0.5 font-normal tabular-nums">
                {r.seats === 1 ? (
                  <User size={10} aria-hidden="true" />
                ) : (
                  <Users size={10} aria-hidden="true" />
                )}
                {r.seats}
              </span>
            </div>
          ))}
        </div>
        {bar && <div className="mt-1">{bar}</div>}
      </div>
      {rows.map((row) => (
        <div key={row.hour} className={`grid ${COLS} items-center gap-1`}>
          <span className="flex flex-col text-xs font-semibold tabular-nums text-base-content/80">
            {hh(row.hour)}
            {row.lesson && (
              <span className="text-[10px] font-semibold leading-none text-warning">
                {t('mobile.library.lessonTag')}
              </span>
            )}
          </span>
          {LIBRARY_ROOMS.map((r) => (
            <Cell
              key={r.featureId}
              room={r}
              hour={row.hour}
              state={row.cells[r.featureId] ?? 'taken'}
              on={pick?.room === r.featureId && pick.hours.includes(row.hour)}
              plus={pick?.room === r.featureId && grow.includes(row.hour)}
              onTap={onTap}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Cell({
  room,
  hour,
  state,
  on,
  plus,
  onTap,
}: {
  room: LibraryRoom;
  hour: number;
  state: CellState;
  on: boolean;
  plus: boolean;
  onTap: (room: number, hour: number) => void;
}) {
  const { t, language } = useTranslation();
  const name = language === 'cz' ? room.nameCs : room.nameEn;
  const label = t('mobile.library.cellAria', { room: name, time: hh(hour) });
  const base = 'flex min-h-11 items-center justify-center rounded-lg';
  if (state === 'mine')
    return (
      <span
        className={`${base} bg-success/15 ring-1 ring-success/40`}
        role="img"
        aria-label={t('mobile.library.cellMine', { room: name, time: hh(hour) })}
      >
        <CircleCheck size={16} className="text-success" aria-hidden="true" />
      </span>
    );
  if (state === 'taken' || state === 'unknown')
    return (
      <span
        className={`${base} ${
          state === 'taken'
            ? 'bg-base-content/10'
            : 'border border-dashed border-base-content/30 text-xs text-base-content/60'
        }`}
        role="img"
        aria-label={t(
          state === 'taken' ? 'mobile.library.cellTaken' : 'mobile.library.cellUnknown',
          {
            room: name,
            time: hh(hour),
          }
        )}
      >
        {state === 'unknown' ? '?' : ''}
      </span>
    );
  return (
    <button
      type="button"
      aria-label={plus ? t('mobile.library.addHour', { time: hh(hour) }) : label}
      aria-pressed={on}
      onClick={() => onTap(room.featureId, hour)}
      className={`${base} ${
        on
          ? 'bg-primary text-primary-content'
          : plus
            ? 'border border-dashed border-primary bg-base-100 text-primary'
            : 'bg-success/20 ring-1 ring-inset ring-success/40'
      }`}
    >
      {plus && <Plus size={16} aria-hidden="true" />}
    </button>
  );
}
