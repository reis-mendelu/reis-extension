import { useState } from 'react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { RoomDirections } from '../../../../CampusMap/RoomDirections';
import {
  LIBRARY_ROOMS,
  type LibraryPart,
  type LibraryRoom,
} from '../../../../../data/map/libraryRooms';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { TINT_BLUE, TINT_GREEN, TINT_GREY } from '../../../../../mobile/library/libraryModel';
import { DAILY_CAP, freeHours, hourSummary } from '../../../../../mobile/library/slots';
import { HourGrid } from './HourGrid';
import type { LibraryView } from './libraryOf';

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The next seven days that are not a weekend, from today. */
function weekdays(from: Date): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    if (d.getDay() !== 0 && d.getDay() !== 6) out.push(d);
  }
  return out;
}

/**
 * The library in the map's panel: the six bookable rooms with what is left
 * today, or one room with its hours. The same slot as the event and society
 * cards, so it inherits the sheet and the rail (and the iPad) from them.
 */
export function LibraryCard({ view, flush }: { view: LibraryView; flush?: boolean }) {
  const room = LIBRARY_ROOMS.find((r) => r.featureId === view.featureId) ?? null;
  return (
    <div data-testid="library-card" className={flush ? 'px-5' : 'px-4'}>
      {room ? <RoomHours room={room} /> : <RoomList group={view.group} />}
    </div>
  );
}

function RoomList({ group }: { group: LibraryPart }) {
  const { t, language } = useTranslation();
  const blocks = useLibraryStore((s) => s.blocks);
  const status = useLibraryStore((s) => s.status);
  const now = new Date();
  const day = iso(now);
  return (
    <div className="space-y-2">
      <PartChips group={group} />
      <p className="text-xs text-base-content/70">{t('mobile.library.pickRoom')}</p>
      {status === 'loading' && (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.loading')}
        </p>
      )}
      {status === 'offline' && (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.offline')}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {LIBRARY_ROOMS.filter((r) => r.part === group).map((r) => (
          <RoomRow
            key={r.featureId}
            room={r}
            lang={language}
            sum={blocks[r.featureId] ? hourSummary(blocks[r.featureId]!, day, now) : null}
          />
        ))}
      </ul>
    </div>
  );
}

/** The two places the rooms are: the camera goes to the one picked. */
function PartChips({ group }: { group: LibraryPart }) {
  const { t } = useTranslation();
  const parts: LibraryPart[] = ['main', 'ic'];
  return (
    <div role="group" className="flex gap-2">
      {parts.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={p === group}
          onClick={() => useAppStore.setState({ mapSelection: { kind: 'library', group: p } })}
          className={`min-h-9 rounded-full px-3 text-sm font-semibold ${
            p === group ? 'bg-primary text-primary-content' : 'bg-base-100 ring-1 ring-base-300'
          }`}
        >
          {t(p === 'main' ? 'mobile.library.partMain' : 'mobile.library.partIc')}
        </button>
      ))}
    </div>
  );
}

function RoomRow({
  room,
  lang,
  sum,
}: {
  room: LibraryRoom;
  lang: 'cz' | 'en';
  sum: { count: number; next: number | null } | null;
}) {
  const { t } = useTranslation();
  const full = sum !== null && sum.count === 0;
  const dot = full ? TINT_GREY : room.kind === 'individual' ? TINT_BLUE : TINT_GREEN;
  const select = () =>
    useAppStore.setState({
      mapSelection: { kind: 'library', featureId: room.featureId, group: room.part },
    });
  // The row spells the room out (the map's "Ind. 1" is only a polygon label) and
  // says how many people it holds: Tým 1 is for 10, Tým 2 for 6.
  const name = (lang === 'cz' ? room.nameCs : room.nameEn)
    .replace(/\s*(studovna|study room)\s*/i, ' ')
    .trim();
  return (
    <li>
      <button
        type="button"
        onClick={select}
        aria-label={lang === 'cz' ? room.nameCs : room.nameEn}
        className="flex min-h-14 w-full items-center gap-2.5 rounded-xl bg-base-100 px-3 py-2 text-left ring-1 ring-base-300"
      >
        <span
          aria-hidden="true"
          className="h-3 w-3 flex-shrink-0 rounded-full"
          style={{ background: dot }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-base-content">{name}</span>
          <span className="block truncate text-xs text-base-content/70">
            {t(room.seats === 1 ? 'mobile.library.seatsOne' : 'mobile.library.seats', {
              n: room.seats,
            })}
          </span>
          <span className="block truncate text-xs text-base-content/70">
            {sum === null
              ? '\u00a0'
              : full
                ? t('mobile.library.full')
                : t('mobile.library.free', { time: `${String(sum.next).padStart(2, '0')}:00` })}
          </span>
        </span>
      </button>
    </li>
  );
}

function RoomHours({ room }: { room: LibraryRoom }) {
  const { t, language } = useTranslation();
  const pushSheet = useAppStore((s) => s.pushSheet);
  const blocks = useLibraryStore((s) => s.blocks[room.featureId]);
  const status = useLibraryStore((s) => s.status);
  const now = new Date();
  const days = weekdays(now);
  const [picked, setDay] = useState<string | null>(null);
  // Opens on the first day with an hour to book, not on a today that is over.
  const firstFree = blocks
    ? days.find((d) => freeHours(blocks, iso(d), now).length > 0)
    : undefined;
  const day = picked ?? iso(firstFree ?? days[0] ?? now);
  const locale = language === 'cz' ? 'cs' : 'en';
  const free = blocks ? freeHours(blocks, day, now) : [];
  const chip = (d: Date) =>
    iso(d) === iso(now)
      ? t('mobile.library.today')
      : d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'numeric' });
  return (
    <div className="space-y-3" data-testid={`library-room-${room.featureId}`}>
      <p className="text-sm font-semibold text-base-content">
        {language === 'cz' ? room.nameCs : room.nameEn}
        <span className="font-normal text-base-content/70">
          {' · '}
          {room.seats === 1
            ? t('mobile.library.seatsOne')
            : t('mobile.library.seats', { n: room.seats })}
        </span>
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {days.map((d) => (
          <button
            key={iso(d)}
            type="button"
            aria-pressed={iso(d) === day}
            onClick={() => setDay(iso(d))}
            className={`min-h-9 flex-shrink-0 rounded-full px-3 text-sm font-semibold ${
              iso(d) === day
                ? 'bg-primary text-primary-content'
                : 'bg-base-100 ring-1 ring-base-300'
            }`}
          >
            {chip(d)}
          </button>
        ))}
      </div>
      {blocks === undefined || status === 'loading' ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.loading')}
        </p>
      ) : blocks === null ? (
        <p role="status" className="text-sm text-base-content/70">
          {t('mobile.library.offline')}
        </p>
      ) : (
        <>
          {free.length === 0 && (
            <p className="text-sm text-base-content/70">{t('mobile.library.fullDay')}</p>
          )}
          <HourGrid
            free={free}
            hours={HOURS}
            onPick={(hour) =>
              pushSheet({ kind: 'libraryBook', featureId: room.featureId, day, hour })
            }
          />
        </>
      )}
      <p className="text-xs text-base-content/60">{t('mobile.library.hint', { cap: DAILY_CAP })}</p>
      <RoomDirections />
    </div>
  );
}
