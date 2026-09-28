import { ArrowDown, ArrowUp, DoorOpen, MapPin } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { directionLines, type DirectionLine } from './roomDirectionLines';
import { useRoomDirections } from './useRoomDirections';

const ICON: Record<DirectionLine['kind'], typeof DoorOpen> = {
  enter: DoorOpen,
  up: ArrowUp,
  down: ArrowDown,
  arrive: MapPin,
};

/**
 * The way to the selected room, floor first: the entrance, the staircase that
 * changes floor, the room. The floor change is the step people get wrong, so it
 * carries the route's colour — the one hue the map gives a way to somewhere.
 * Shared by the desktop detail panel, the phone's sheet and the tablet's rail.
 */
export function RoomDirections() {
  const { t } = useTranslation();
  const directions = useRoomDirections();
  if (!directions) return null;
  return (
    <section data-testid="room-directions" className="space-y-2">
      <h4 className="text-xs font-semibold text-base-content/70">{t('map.directions.title')}</h4>
      <ol className="space-y-2">
        {directionLines(directions.steps, t).map((line, i) => {
          const Icon = ICON[line.kind];
          const change = line.kind === 'up' || line.kind === 'down';
          return (
            <li key={i} className="flex items-start gap-3">
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                  change
                    ? 'bg-[var(--color-route)] text-white'
                    : 'bg-base-content/10 text-base-content/70'
                }`}
              >
                <Icon size={14} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-base-content">
                  {line.spoken && <span className="sr-only">{`${line.spoken} `}</span>}
                  {line.primary}
                </span>
                <span className="block text-xs text-base-content/70">{line.secondary}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
