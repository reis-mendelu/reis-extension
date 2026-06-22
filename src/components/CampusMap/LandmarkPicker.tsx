import { MapPin } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { landmarkGroupLabels, polygonCentroid } from './mapHelpers';
import landmarksJson from '../../data/map/landmarks.json';
import type { Landmark } from '../../types/campusMap';

const LANDMARKS = (landmarksJson as { landmarks: Landmark[] }).landmarks;
const isJak = (l: Landmark) => l.name.startsWith('Koleje JAK');
const JAK = LANDMARKS.filter(isJak);
const NON_JAK = LANDMARKS.filter((l) => !isJak(l));
const NON_JAK_LABELS = landmarkGroupLabels(NON_JAK);

// Collapse co-located landmarks into one row: FRRMS + Kolej Akademie (same
// outline) and Tauferovy koleje + sports centre (overlap) each become a single
// "A / B" entry that flies to the shared coordinate. One row, both names.
const PLACE_GROUPS = (() => {
  const seen = new Set<string>();
  const groups: { label: string; ids: number[] }[] = [];
  for (const l of NON_JAK) {
    const label = NON_JAK_LABELS.get(l.id) ?? l.name;
    if (seen.has(label)) continue;
    seen.add(label);
    groups.push({ label, ids: NON_JAK.filter((x) => (NON_JAK_LABELS.get(x.id) ?? x.name) === label).map((x) => x.id) });
  }
  return groups;
})();

// Centre of the JAK dorm cluster (the four blocks are 65–110 m apart, so one
// fly to their average centroid frames them all).
const JAK_CENTROID: [number, number] = (() => {
  const cs = JAK.map((l) => polygonCentroid(l.outline.coordinates[0]));
  const n = cs.length || 1;
  return [cs.reduce((s, c) => s + c[0], 0) / n, cs.reduce((s, c) => s + c[1], 0) / n];
})();

// Compact top-right "discovery" panel: a handful of grouped destinations rather
// than every place. Co-located places share a row; the JAK blocks and the whole
// main campus each collapse to one row. Shown in both overview and floor-view.
export function LandmarkPicker() {
  const selection = useAppStore((s) => s.mapSelection);
  const focusLandmark = useAppStore((s) => s.focusLandmarkById);
  const focusPoint = useAppStore((s) => s.focusPoint);
  const focusCampus = useAppStore((s) => s.focusCampus);
  const { t } = useTranslation();
  const selectedLandmark = selection?.kind === 'poi' ? selection.poi.id : null;

  const row = (key: string, label: string, active: boolean, run: () => void) => (
    <li key={key}>
      <button className={`justify-start ${active ? 'menu-active' : ''}`} onClick={run}>{label}</button>
    </li>
  );

  return (
    <div className="flex max-h-[80%] w-64 flex-col rounded-box border border-base-300 bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
      <div className="flex items-center gap-1.5 border-b border-base-300 px-3 py-2 text-sm font-semibold">
        <MapPin size={14} className="text-primary" />
        {t('map.places')}
      </div>
      <ul className="menu menu-sm w-full flex-nowrap overflow-y-auto p-1">
        {PLACE_GROUPS.map((g) =>
          row(String(g.ids[0]), g.label, g.ids.includes(selectedLandmark ?? -2), () => focusLandmark(g.ids[0])),
        )}
        {row('jak', t('map.jakDorms'), selectedLandmark === -1, () => focusPoint(t('map.jakDorms'), JAK_CENTROID))}
        {row('campus', t('map.mainCampus'), false, () => focusCampus())}
      </ul>
    </div>
  );
}
