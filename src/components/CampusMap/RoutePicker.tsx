import campusPaths from '../../data/map/campusPaths.json';
import type { CampusGraph } from '../../types/campusMap';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * The buildings you can be routed to — read from the GRAPH, not from
 * buildings.json.
 *
 * Those two lists agree today, and the graph is the one that has to: a building
 * the router has no nodes for would be a button that cannot work. Offering
 * exactly what is routable makes the failure mode a missing button rather than
 * a dead one.
 */
const ROUTABLE = Object.keys(
  (campusPaths as unknown as { graph: CampusGraph }).graph.buildings
).sort();

/**
 * Where are you headed — seven campus buildings, by their letter.
 *
 * Rendered as sheet CONTENT rather than as a popover over the map, because the
 * sheet is `overflow-hidden`: anything opening upward out of it is clipped, and
 * the version that tried was invisible in a way no test would have caught. The
 * sheet hugs its content while this is open, so it grows to fit and shrinks
 * back.
 *
 * Seven bare letters is not a good answer to "where are you headed" — a
 * first-year's timetable says Q01, not Q. This is the fallback; the destination
 * a student actually wants is their next lesson, which `nextLessonTarget`
 * resolves and which should land above this list rather than beside it.
 */
export function RoutePicker() {
  const { t } = useTranslation();
  const open = useAppStore((s) => s.routePickerOpen);
  const setOpen = useAppStore((s) => s.setRoutePickerOpen);
  const routeTo = useAppStore((s) => s.routeTo);

  if (!open) return null;

  const choose = (name: string) => {
    setOpen(false);
    void routeTo(name);
  };

  return (
    // Sits ABOVE the button that opened it.
    //
    // No entry animation on this element. `animate-in fade-in
    // slide-in-from-bottom-2` was here first and compiled to NOTHING —
    // tailwindcss-animate is not installed, and tailwind.config.js documents
    // this exact failure twice: the class name survives in the className string
    // and never matches a rule, which no test can see. The softness comes from
    // the sheet itself, which already carries `transition-[height] duration-300`
    // and grows to fit this.
    <div role="menu" className="flex-shrink-0 px-5 pb-2 pt-1">
      <p className="mb-2 text-[13px] text-base-content/60">{t('map.routePickBuilding')}</p>
      {/* A 7-column grid, not flex-wrap. Seven 44px squares plus gaps need
          356px and the sheet offers 335, so wrapping put a lone X on a second
          row — directly under the floating BottomNav, which covered it. The
          grid divides what there is, so every letter stays reachable on the
          narrowest phone. */}
      <div className="grid grid-cols-7 gap-1.5">
        {ROUTABLE.map((name) => (
          <button
            key={name}
            type="button"
            role="menuitem"
            // 44 square. The first version was 40x32, below the floor this app
            // already holds its own nav to.
            className="btn btn-outline h-11 min-h-11 w-full p-0 text-base"
            onClick={() => choose(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
