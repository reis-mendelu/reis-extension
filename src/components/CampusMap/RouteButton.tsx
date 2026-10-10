import { Navigation } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { nextLessonTarget } from '../../utils/routing/nextLessonTarget';
import { devForcedNow } from '../../utils/routing/devPosition';
import { hasWalksTo } from '../../utils/routing/routableStart';

/**
 * "Kam jdeš?" — route to the lesson the student pointed at, else the next one
 * today, else open the picker.
 *
 * The timetable comes FIRST. That is the whole feature: reIS knows the student
 * has a lesson in Q31 at 13:00, so tapping this should walk them there rather
 * than asking them which letter of the alphabet they want. The picker is the
 * fallback for when there is no lesson left today — and for a lesson in budova
 * Z, which has a floor plan but no walks in v1 (`hasWalksTo`).
 *
 * Lives in the sheet's peek row and the rail, not floating over the map, and
 * the reason is contrast. As an overlay it was `btn btn-primary btn-sm`: a 32px
 * pale-green pill on a basemap that is always light whatever the app theme is,
 * and it read as a ghost. Everything over this map either carries its own dark
 * surface — as the search bar does, with a hardcoded rgba — or disappears.
 *
 * `min-h-11` because the BottomNav in this same app already holds itself to 44,
 * and this one is pressed while walking.
 */
export function RouteButton() {
  const { t } = useTranslation();
  // In the store rather than useState: "NO generic state" is an Iron Rule here,
  // and it means something else can open the picker later — a search result, a
  // tapped building.
  const open = useAppStore((s) => s.routePickerOpen);
  const setOpen = useAppStore((s) => s.setRoutePickerOpen);
  const status = useAppStore((s) => s.routeStatus);
  const routeTo = useAppStore((s) => s.routeTo);
  const lessons = useAppStore((s) => s.schedule.data);
  // The pin beside a timetable row puts a lesson here on its way to the map.
  // It wins over the timetable's own answer, and the reason is that the student
  // named a lecture: tapping the pin on Thursday's block and being walked to
  // whatever is next today is the wrong building with no note saying so.
  const suggestion = useAppStore((s) => s.routeSuggestion);

  const press = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // The next lesson only when the router reaches its building — budova Z has
    // a floor plan but no walks in v1, and there the picker is the answer.
    const next = nextLessonTarget(lessons, devForcedNow() ?? new Date());
    const target = suggestion ?? (next && hasWalksTo(next.buildingName) ? next : null);
    if (target) {
      void routeTo(target.buildingName);
      return;
    }
    setOpen(true);
  };

  return (
    <button
      type="button"
      // `shrink min-w-0`, where it used to be `flex-shrink-0`. With a room in
      // the label this button is 178px wide, and at 320 the row it shares
      // could not absorb that — it hung 26px off the screen. Both utilities
      // are load-bearing: DaisyUI's `.btn` sets `flex-shrink: 0` itself, so
      // dropping the utility alone left the computed value at 0 and the
      // longest room name in the index still ran 71px past the viewport.
      // Allowed to shrink, the span inside truncates and the peek hint beside
      // it gives way first.
      className="btn btn-primary min-h-11 min-w-0 shrink gap-2"
      onClick={press}
      disabled={status === 'locating'}
      aria-expanded={open}
      aria-haspopup="menu"
    >
      <Navigation size={16} aria-hidden />
      {/* The room, when one was pointed at — "Doveď mě do Q31" is a promise
          about that lecture, where "Najdi cestu" is a promise about nothing in
          particular. Truncated because 23 rooms in the index carry a name
          longer than the peek row can hold. */}
      <span className="truncate">
        {suggestion
          ? t('map.routeToRoom', { room: suggestion.roomLabel })
          : t('map.routeTakeMeThere')}
      </span>
    </button>
  );
}
