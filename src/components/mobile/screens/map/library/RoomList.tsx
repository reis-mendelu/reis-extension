import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { roomStatus, type RoomStatus } from '../../../../../mobile/library/libraryDay';
import { TINT_FREE, TINT_FULL, sizeGroups } from '../../../../../mobile/library/libraryModel';

/** All six rooms in one list, grouped by size, each with its one name and what is left. */
export function RoomList({ day, now }: { day: string; now: Date }) {
  const { t, language } = useTranslation();
  const blocks = useLibraryStore((s) => s.blocks);
  const loading = useLibraryStore((s) => s.status === 'loading' || s.status === 'idle');
  return (
    <div className="space-y-3">
      {sizeGroups().map(({ seats, rooms }) => (
        <section key={seats}>
          <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
            {seats === 1
              ? t('mobile.library.sizeOne')
              : t('mobile.library.sizeGroup', { n: seats })}
          </h3>
          <ul className="space-y-1">
            {rooms.map((r) => (
              <RoomRow
                key={r.featureId}
                name={language === 'cz' ? r.nameCs : r.nameEn}
                status={roomStatus(blocks[r.featureId], day, now, loading)}
                onOpen={() => useAppStore.getState().selectMapLibrary(r.featureId)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function RoomRow({
  name,
  status,
  onOpen,
}: {
  name: string;
  status: RoomStatus;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const known = status.kind === 'from' || status.kind === 'full';
  const free = status.kind === 'from';
  const text =
    status.kind === 'from'
      ? t('mobile.library.from', { time: `${String(status.hour).padStart(2, '0')}:00` })
      : status.kind === 'full'
        ? t('mobile.library.full')
        : status.kind === 'loading'
          ? t('mobile.library.checking')
          : t('mobile.library.unknownRow');
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-base-100 px-3 text-left ring-1 ring-base-content/10"
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={
            known
              ? { background: free ? TINT_FREE : TINT_FULL }
              : { boxShadow: 'inset 0 0 0 1.5px currentColor', opacity: 0.5 }
          }
        />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-base-content">
          {name}
        </span>
        <span
          className={`flex-shrink-0 whitespace-nowrap text-[13px] ${free ? 'font-semibold text-success' : 'text-base-content/70'}`}
        >
          {text}
        </span>
      </button>
    </li>
  );
}
