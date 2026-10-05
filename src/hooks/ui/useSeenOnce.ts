import { useEffect, useState, type RefObject } from 'react';

/**
 * One observer for every watched element, as PdfViewer does for its pages: a
 * 519-student lecture would otherwise run 519 IntersectionObserver instances.
 * Created on the first watch, disconnected when the last element leaves.
 */
let shared: { io: IntersectionObserver; onSeen: Map<Element, () => void> } | null = null;

function unwatch(el: Element): void {
  if (!shared) return;
  shared.io.unobserve(el);
  shared.onSeen.delete(el);
  if (shared.onSeen.size === 0) {
    shared.io.disconnect();
    shared = null;
  }
}

function watch(el: Element, onSeen: () => void): () => void {
  if (!shared) {
    const callbacks = new Map<Element, () => void>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const cb = e.isIntersecting ? callbacks.get(e.target) : undefined;
        if (!cb) continue;
        unwatch(e.target);
        cb();
      }
    });
    shared = { io, onSeen: callbacks };
  }
  shared.onSeen.set(el, onSeen);
  shared.io.observe(el);
  return () => unwatch(el);
}

/**
 * True once the element is on screen, and true from then on — scrolling it
 * away again does not take it back.
 *
 * The implicit root (the viewport) on purpose: intersection is clipped by every
 * scrolling ancestor, so it is right whichever element actually scrolls. That
 * differs per tree — the extension drawer's outer body scrolls the classmates
 * tab, the phone the tab's own box — and an explicit root that turned out not
 * to clip would report every row visible at once. No `rootMargin`: it grows
 * only the root, never an ancestor's clip, so it would prefetch nothing.
 *
 * Where IntersectionObserver does not exist, everything counts as seen.
 */
export function useSeenOnce(ref: RefObject<Element | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    return watch(el, () => setSeen(true));
  }, [ref, seen]);

  return seen;
}
