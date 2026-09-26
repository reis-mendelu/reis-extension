import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { hasBuildingModel } from '../../data/map/buildingModels';
import { hasWebGL2 } from './webgl';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import type { RoomTarget } from './roomTarget';

const Building3DCanvas = lazy(() => import('./Building3DCanvas'));

/**
 * The way a student says the floor, not the map's raw level: Q4.03 is on level 3,
 * which is "3. patro" (and 4.NP on the door). "Podlaží 3" would contradict the
 * room's own name, because podlaží counts the ground floor as the first.
 */
function floorText(
  level: number | null,
  t: (key: string, p?: Record<string, string | number>) => string
) {
  if (level === null) return '–';
  if (level === 0) return t('map.floorGround');
  return level > 0 ? t('map.floorAbove', { n: level }) : t('map.floorBelow', { n: -level });
}

export interface Building3DCardProps {
  target: RoomTarget | null;
  /**
   * Shown whenever the 3D card cannot be: a building without a model, no WebGL2,
   * the model or rooms still loading, or the model failed. The hover card passes
   * today's flat floor thumbnail; the map passes nothing, because the map itself
   * already shows the floor.
   */
  fallback?: ReactNode;
  /**
   * `card` (default) stacks the canvas over a caption, for panels and sheets.
   * `fill` takes its parent's whole box with the caption over the canvas, for
   * the fixed-size desktop hover card.
   */
  variant?: 'card' | 'fill';
}

/**
 * A room's building in 3D, cut open at the room's floor — the pilot shows Q.
 * Reads the store synchronously; the model and floor plan are loaded by the
 * same intents that load the flat plan (hover, map selection).
 */
export function Building3DCard({ target, fallback = null, variant = 'card' }: Building3DCardProps) {
  const { t } = useTranslation();
  const model = useAppStore((s) => (target ? s.buildingModels[target.buildingId] : undefined));
  const rooms = useAppStore((s) => (target ? s.roomsByBuilding[target.buildingId] : undefined));
  // Keyed on the level, not the target object: callers build a fresh target on
  // every render, and a new rooms array would rebuild the whole WebGL scene.
  const level = target?.floorLevel ?? null;
  const floorRooms = useMemo(
    () => (rooms ? rooms.features.filter((f) => f.properties.floorLevel === level) : []),
    [rooms, level]
  );

  if (!target || !hasBuildingModel(target.buildingId) || !hasWebGL2()) return <>{fallback}</>;
  if (!model || model === 'failed' || !rooms) return <>{fallback}</>;

  const parts = {
    building: model.meta.name,
    floor: floorText(target.floorLevel, t),
    room: target.label,
  };
  // The boundary catches a chunk that fails to load and a renderer that cannot
  // be built; either way the student gets the flat plan, never a blank app.
  const canvas = (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Building3DCanvas
          model={model}
          rooms={floorRooms}
          targetLevel={target.floorLevel}
          targetRoomId={target.roomId}
          ariaLabel={t('map.building3dAria', parts)}
        />
      </Suspense>
    </ErrorBoundary>
  );
  const label = (
    <span className="text-sm font-semibold text-base-content">
      {t('map.building3dLabel', parts)}
    </span>
  );
  const credit = <span className="text-[11px] text-base-content/70">{model.meta.attribution}</span>;

  if (variant === 'fill') {
    return (
      <figure className="relative m-0 h-full w-full" data-testid="building-3d-card">
        {canvas}
        <figcaption className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg bg-base-100/85 px-2 py-1">
          {label}
          {credit}
        </figcaption>
      </figure>
    );
  }
  return (
    <figure className="m-0 flex flex-col gap-1.5" data-testid="building-3d-card">
      {/* Capped by the viewport: a phone turned sideways gives the rail 55vh of a
          390px screen, and a fixed 14rem pushed the caption out of it. */}
      <div className="relative h-[min(14rem,28vh)] w-full overflow-hidden rounded-xl bg-base-200">
        {canvas}
      </div>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 px-1">
        {label}
        {credit}
      </figcaption>
    </figure>
  );
}
