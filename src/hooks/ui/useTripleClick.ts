import { useRef } from 'react';

/** Returns an onClick handler that invokes `onTriple` after 3 clicks/taps within
 *  `windowMs`. Works for mouse and touch (triple-tap). */
export function useTripleClick(onTriple: () => void, windowMs = 600): () => void {
  const clicks = useRef<number[]>([]);
  return () => {
    const now = Date.now();
    clicks.current = clicks.current.filter((t) => now - t < windowMs);
    clicks.current.push(now);
    if (clicks.current.length >= 3) {
      clicks.current = [];
      onTriple();
    }
  };
}
