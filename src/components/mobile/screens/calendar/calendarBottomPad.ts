/**
 * The bottom padding of the agenda and the week grid: it clears the floating
 * tab bar (18px inset + ~58px) AND the Den/Týden switch floating 8px above it
 * (`CalendarViewSwitch`, ~54px with its 44px buttons), so neither ever covers a lesson.
 *
 * This band is the switch's cost, ~54px on every calendar state, and it was
 * the reason #528 took the switch off the screen. Spec 2026-10-30 keeps it on
 * the screen anyway: hidden in Nastavení, nobody found Týden.
 *
 * A full literal class string, so Tailwind's scanner sees it.
 */
export const CALENDAR_BOTTOM_PAD = 'pb-[calc(9.5rem_+_var(--safe-bottom,0px))]';
