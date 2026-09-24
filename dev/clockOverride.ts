import { useAppStore } from '../src/store/useAppStore';
import { resolveDevClockOffset } from '../src/utils/resolveDevClockOffset';
import { isHarnessEnabled } from '../src/utils/harnessEnabled';

// Dev-only clock override: `?now=10:30` (or `?now=2026-05-04 08:15`) moves the
// app's clock, so a state that only exists at a given hour can be worked on at
// any hour — a lesson running right now, its countdown, the "Pak:" line, a
// registration that opens in ten minutes.
//
// The fixture authors lessons AROUND `now` (see startMinutesFromNow in
// scripts/lib/fixtureRebase.ts); this moves `now` itself, for the cases where
// the wall clock is the problem — at 23:31 a running lesson crosses midnight
// and the day view is not what you meant to look at.
//
// It wraps `updatePulse` rather than writing `now` once, so the clock keeps
// ticking at its real rate from the shifted moment. Guarded by
// isHarnessEnabled, the same guard phoneOverride uses, so it cannot ship in the
// extension or the Capacitor build.
if (isHarnessEnabled(import.meta.env)) {
  const offset = resolveDevClockOffset(
    new URLSearchParams(window.location.search).get('now'),
    new Date()
  );
  if (offset !== null) {
    const shifted = () => new Date(Date.now() + offset);
    useAppStore.setState({
      now: shifted(),
      updatePulse: () => useAppStore.setState({ now: shifted() }),
    });
  }
}
