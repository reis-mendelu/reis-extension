/**
 * The loading state every mobile screen shows before its data arrives.
 *
 * Two things it exists to fix, both found on a real first sign-in:
 *
 * 1. **It has to be legible.** The old per-screen skeletons drew their
 *    placeholder bars in `bg-base-300`, which in the dark theme is #0f172a on a
 *    #1f2937 page. Measured with `scripts/lib/contrast.ts`, that is **1.22:1
 *    in dark and 1.10:1 in light** — above the 1.05 floor `verify:ui` flags, so
 *    the harness would have passed it, and far below anything a person can see.
 *    It was reported as "a grey screen with no components", which is exactly
 *    what it was.
 *    `bg-base-content/20` measures **1.85:1 dark / 1.53:1 light**: visible in
 *    both themes without shouting. `/10` was tried first and is not enough
 *    (1.34 / 1.23) — do not lower it back.
 * 2. **It has to say it is loading.** Shapes alone read as an empty screen; a
 *    spinner and a sentence read as work in progress. The label is per-screen
 *    ("Načítám rozvrh…") so a student knows which of the parallel fetches they
 *    are waiting on.
 *
 * The top padding carries `--safe-top` for the same reason ScreenHeader does:
 * this is the topmost element on the screen while it shows, and without it the
 * spinner renders under the status bar and camera cutout. Expressed as a
 * Tailwind arbitrary value rather than a style prop, matching LoginGate — the
 * "no custom CSS" rule is about keeping the visual system in utilities, and an
 * arbitrary utility still is one.
 */
/**
 * Staggered starts, so the rows read as a queue filling in rather than one
 * block flashing. Spelled out as literal classes because Tailwind scans source
 * text — a computed `[animation-delay:${i * 120}ms]` would emit no CSS at all.
 */
const DELAYS = [
  '',
  '[animation-delay:120ms]',
  '[animation-delay:240ms]',
  '[animation-delay:360ms]',
  '[animation-delay:480ms]',
];

export function ScreenSkeleton({
  testId,
  label,
  rows,
}: {
  testId: string;
  label: string;
  /** Tailwind height classes, one per placeholder bar, top to bottom. */
  rows: string[];
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-1 flex-col gap-3 overflow-hidden px-5 pb-5 pt-[calc(1.25rem_+_var(--safe-top,0px))]"
    >
      <div className="flex items-center gap-2.5 pb-1 text-sm font-medium text-base-content/70">
        <span className="loading loading-spinner loading-md text-primary" />
        <span>{label}</span>
      </div>
      {rows.map((height, i) => (
        <div
          key={i}
          className={`${height} ${DELAYS[i] ?? ''} animate-pulse rounded-2xl bg-base-content/20`}
        />
      ))}
    </div>
  );
}
