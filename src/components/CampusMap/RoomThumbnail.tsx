import { useEffect, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import roomsIndexJson from '../../data/map/rooms-index.json';
import { ringToLatLng } from './mapHelpers';
import { projectRing, type Extent } from './thumbnail';
import type { RoomIndexEntry, RoomFeature } from '../../types/campusMap';

const INDEX = roomsIndexJson as RoomIndexEntry[];
const BOX = { w: 380, h: 240, pad: 8 };

export function RoomThumbnail({ roomName }: { roomName: string }) {
  const entry = useMemo(() => INDEX.find((e) => e.code === roomName || e.name === roomName), [roomName]);
  const rooms = useAppStore((s) => (entry ? s.roomsByBuilding[entry.buildingId] : undefined));
  const loadMapBuilding = useAppStore((s) => s.loadMapBuilding);

  useEffect(() => { if (entry && !rooms) void loadMapBuilding(entry.buildingId); }, [entry, rooms, loadMapBuilding]);

  if (!entry) return <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm">—</div>;
  if (!rooms) return <div className="flex-1 flex items-center justify-center"><span className="loading loading-spinner loading-md" /></div>;

  const floor = rooms.features.filter((f) => f.properties.floorId === entry.floorId) as RoomFeature[];
  const rings = floor.map((f) => ringToLatLng(f.geometry.coordinates[0]));
  const all = rings.flat();
  const ext: Extent = {
    minLat: Math.min(...all.map((p) => p[0])), maxLat: Math.max(...all.map((p) => p[0])),
    minLng: Math.min(...all.map((p) => p[1])), maxLng: Math.max(...all.map((p) => p[1])),
  };
  return (
    <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} className="w-full h-full">
      {floor.map((f, i) => {
        const isTarget = f.properties.id === entry.placeId;
        return <polygon key={i} points={projectRing(ringToLatLng(f.geometry.coordinates[0]), BOX, ext)}
          className={isTarget ? 'fill-primary stroke-primary-content' : 'fill-base-300 stroke-base-content/20'}
          strokeWidth={isTarget ? 1.5 : 0.5} />;
      })}
    </svg>
  );
}
