import { useEffect, useMemo, useRef } from 'react';

/**
 * Which setup run is the live one. `begin` starts a run and returns its
 * `stale` check; `invalidate` (reset, a device pick) leaves every run in
 * flight behind. A request that answers after either belongs to a flow the
 * student has left, and its result is dropped — otherwise an expired
 * certificate could come back after the drawer was closed, with a renew
 * button that had no device to renew for.
 */
export function useRunGeneration() {
  const current = useRef(0);
  return useMemo(
    () => ({
      begin: () => {
        const mine = ++current.current;
        return () => mine !== current.current;
      },
      invalidate: () => {
        current.current++;
      },
    }),
    []
  );
}

/**
 * Fires `select(target)` exactly once, only when a caller (the sheet) hands
 * `useEduroamSetup` a pre-resolved target. The desktop drawer never passes
 * one, so this is a no-op there — selection stays a user click.
 */
export function useAutoSelectOnce<T>(target: T | undefined, select: (t: T) => void) {
  const done = useRef(false);
  useEffect(() => {
    if (target && !done.current) {
      done.current = true;
      select(target);
    }
  }, [target, select]);
}
