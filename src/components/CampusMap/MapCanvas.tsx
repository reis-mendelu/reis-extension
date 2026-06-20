import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAppStore } from '../../store/useAppStore';
import buildingsJson from '../../data/map/buildings.json';
import poisJson from '../../data/map/pois.json';
import { ringToLatLng, shortLabel, categoryColorVar } from './mapHelpers';
import type { BuildingsMeta, PoiFeature, RoomFeature } from '../../types/campusMap';

const META = buildingsJson as BuildingsMeta;
const POIS = (poisJson as unknown as { features: PoiFeature[] }).features;

function themeColor(varName: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || '#cccccc';
}

export function MapCanvas() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup>(L.layerGroup());

  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const roomsByBuilding = useAppStore((s) => s.roomsByBuilding);
  const focusReq = useAppStore((s) => s.mapFocusRequest);

  // init once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: false, minZoom: 14, maxZoom: 22 })
      .fitBounds(META.campus.bounds as L.LatLngBoundsExpression);
    layerRef.current.addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // draw campus overview or the active floor
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const layer = layerRef.current; layer.clearLayers();
    const select = useAppStore.getState();

    if (activeBuildingId === null) {
      for (const b of META.buildings) {
        L.polygon(ringToLatLng(b.outline.coordinates[0]), {
          color: themeColor('--color-base-content'), weight: 1,
          fillColor: themeColor('--color-primary'), fillOpacity: 0.18,
        }).on('click', () => select.setMapBuilding(b.id)).bindTooltip(b.name).addTo(layer);
      }
      for (const f of POIS) {
        const [lon, lat] = f.geometry.coordinates;
        L.circleMarker([lat, lon], { radius: 6, color: themeColor('--color-secondary'),
          fillColor: themeColor('--color-secondary'), fillOpacity: 0.9 })
          .on('click', () => select.selectMapPoi(f.properties, f.geometry.coordinates))
          .bindTooltip(f.properties.name).addTo(layer);
      }
      map.flyToBounds(META.campus.bounds as L.LatLngBoundsExpression, { maxZoom: 18, padding: [40, 40] });
      return;
    }

    const fc = roomsByBuilding[activeBuildingId];
    const b = META.buildings.find((x) => x.id === activeBuildingId);
    if (b) map.flyToBounds(b.bounds as L.LatLngBoundsExpression, { maxZoom: 21, padding: [50, 50] });
    if (!fc) return; // geometry still loading
    const feats = fc.features.filter((f) => f.properties.floorId === activeFloorId)
      .sort((a) => (a.properties.category === 'structure' ? -1 : 1));
    for (const f of feats as RoomFeature[]) {
      const p = f.properties, struct = p.category === 'structure';
      const poly = L.polygon(ringToLatLng(f.geometry.coordinates[0]), {
        color: themeColor('--color-base-content'), weight: struct ? 0.6 : 1,
        fillColor: themeColor(categoryColorVar(p.category)),
        fillOpacity: struct ? 0.35 : 0.8, interactive: !struct,
      });
      if (!struct) {
        poly.on('click', () => select.selectMapRoom(p));
        if (p.name) poly.bindTooltip(shortLabel(p.name), { permanent: false, direction: 'center' });
      }
      poly.addTo(layer);
    }
  }, [activeBuildingId, activeFloorId, roomsByBuilding, focusReq]);

  return <div ref={ref} className="absolute inset-0" />;
}
