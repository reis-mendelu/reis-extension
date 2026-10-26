import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Escape closes the topmost overlay, and only that one.
 *
 * Overlays nest — a classmate's drawer opens over the subject drawer that
 * listed them, the feedback form over either — so each overlay answering every
 * Escape shut the whole pile at once. The layer opened last is on top and is
 * the only one that closes.
 *
 * "Opened last" is a sequence number taken while RENDERING, not the order the
 * effects run in. React runs a child's effects before its parent's, so a
 * parent and a layer inside it that open in the same commit registered
 * child-first and left the parent on top. Renders go parent-first, so the
 * number puts the inner layer above the outer one, and a layer that opens in a
 * later commit above both.
 *
 * Bubble phase on `document`, so a control inside that uses Escape for itself
 * (an inline title editor, a picker's open list) runs first through React's
 * root listener and keeps the key by calling `preventDefault`. vaul's phone
 * drawer is not a layer here: Radix handles its Escape in the capture phase and
 * prevents the default itself — which is why it has to hand the key over
 * through `closeTopEscapeLayer` when a layer is open above it.
 */
interface Layer {
  id: symbol;
  seq: number;
  close: { current: () => void };
}
const stack: Layer[] = [];
let opened = 0;

const top = (): Layer | undefined => stack[stack.length - 1];

/** Whether any layer is open — the phone's sheet stack yields to it. */
export function hasOpenEscapeLayer(): boolean {
  return stack.length > 0;
}

/**
 * Closes the topmost layer, for a handler that must consume the Escape before
 * the layers can see it (vaul's Radix listener runs in the capture phase).
 */
export function closeTopEscapeLayer(): boolean {
  const layer = top();
  if (!layer) return false;
  layer.close.current();
  return true;
}

export function useEscapeLayer(open: boolean, onClose: () => void): void {
  // Read through a ref so a new onClose each render neither re-registers the
  // layer nor moves it to the top of the stack.
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  // Set during render, React's sanctioned way to derive state from a prop
  // change; see the header for why the number has to come from render.
  const [seq, setSeq] = useState<number | null>(null);
  if (open && seq === null) setSeq(++opened);
  if (!open && seq !== null) setSeq(null);

  useEffect(() => {
    if (seq === null) return;
    const layer: Layer = { id: Symbol('escape-layer'), seq, close };
    stack.push(layer);
    stack.sort((a, b) => a.seq - b.seq);
    const onKeyDown = (e: KeyboardEvent) => {
      // `repeat`: a held key auto-repeats, and each repeat would close the
      // next layer down. One press, one layer.
      if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || e.isComposing) return;
      if (top()?.id !== layer.id) return;
      e.preventDefault();
      close.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const at = stack.indexOf(layer);
      if (at !== -1) stack.splice(at, 1);
    };
  }, [seq]);
}
