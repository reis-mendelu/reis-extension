import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Escape closes the topmost overlay, and only that one.
 *
 * Overlays nest — a classmate's drawer opens over the subject drawer that
 * listed them, the feedback form over either — so each overlay answering every
 * Escape shut the whole pile at once. The layer opened last is on top and is
 * the only one that closes.
 *
 * "Opened last" is not effect order. React runs a child's effects before its
 * parent's, so a parent and a layer inside it that open in one commit would
 * register child-first and leave the parent on top. Layers are grouped by the
 * flush they register in (a commit's effects run synchronously, so one flush
 * ends at the next microtask): a later flush is above an earlier one, and
 * within a flush the layer MOUNTED later is above — mount order is render
 * order, parent before child, taken once in a `useState` initializer.
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
  flush: number;
  mount: number;
  close: { current: () => void };
}
const stack: Layer[] = [];
let mounts = 0;

let flush = 0;
let flushOpen = false;
/** The current effect flush; it ends at the next microtask. */
function currentFlush(): number {
  if (!flushOpen) {
    flushOpen = true;
    queueMicrotask(() => {
      flush++;
      flushOpen = false;
    });
  }
  return flush;
}

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
  const [mount] = useState(() => ++mounts);

  useEffect(() => {
    if (!open) return;
    const layer: Layer = { id: Symbol('escape-layer'), flush: currentFlush(), mount, close };
    stack.push(layer);
    stack.sort((x, y) => x.flush - y.flush || x.mount - y.mount);
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
  }, [open, mount]);
}
