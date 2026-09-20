import { useState } from 'react';
import { Navigation } from 'lucide-react';
import campusPaths from '../../data/map/campusPaths.json';
import type { CampusGraph } from '../../types/campusMap';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * The buildings you can be routed to — read from the GRAPH, not from
 * buildings.json.
 *
 * Those two lists agree today, and the graph is the one that has to: a building
 * the router has no nodes for is a button that cannot work. Offering exactly
 * what is routable means the failure mode is a missing button rather than a
 * dead one.
 */
const ROUTABLE = Object.keys(
  (campusPaths as unknown as { graph: CampusGraph }).graph.buildings
).sort();

/**
 * "Take me there" — pick a building, get the walk from where you are standing.
 *
 * This is the fallback destination picker. Once the timetable is wired in, the
 * next lesson's room is the default and this is what a student falls back to
 * when there is no lesson left today.
 */
export function RouteButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const routeTo = useAppStore((s) => s.routeTo);
  const status = useAppStore((s) => s.routeStatus);

  const choose = (name: string) => {
    setOpen(false);
    void routeTo(name);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        className="btn btn-primary btn-sm gap-2 shadow-lg"
        onClick={() => setOpen((v) => !v)}
        disabled={status === 'locating'}
        aria-expanded={open}
      >
        <Navigation size={15} aria-hidden />
        {t('map.routeTakeMeThere')}
      </button>

      {open && (
        <div className="card bg-base-100 shadow-lg">
          <div className="card-body gap-2 p-3">
            <p className="text-sm opacity-70">{t('map.routePickBuilding')}</p>
            <div className="flex flex-wrap gap-1.5">
              {ROUTABLE.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="btn btn-outline btn-sm w-10"
                  onClick={() => choose(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
