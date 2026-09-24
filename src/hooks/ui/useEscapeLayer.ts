import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Escape closes the topmost overlay, and only that one.
 *
 * Overlays nest — a classmate's drawer opens over the subject drawer that
 * listed them, the feedback form over either — so each overlay answering every
 * Escape shut the whole pile at once. Layers register in the order they open;
 * the last one registered is on top and is the only one that closes.
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
  close: { current: () => void };
}
const stack: Layer[] = [];

/** Whether any layer is open — the phone's sheet stack yields to it. */
export function hasOpenEscapeLayer(): boolean {
  return stack.length > 0;
}

/**
 * Closes the topmost layer, for a handler that must consume the Escape before
 * the layers can see it (vaul's Radix listener runs in the capture phase).
 */
export function closeTopEscapeLayer(): boolean {
  const top = stack[stack.length - 1];
  if (!top) return false;
  top.close.current();
  return true;
}

export function useEscapeLayer(open: boolean, onClose: () => void): void {
  // Read through a ref so a new onClose each render neither re-registers the
  // layer nor moves it to the top of the stack.
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol('escape-layer');
    stack.push({ id, close });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      if (stack[stack.length - 1]?.id !== id) return;
      e.preventDefault();
      close.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const at = stack.findIndex((layer) => layer.id === id);
      if (at !== -1) stack.splice(at, 1);
    };
  }, [open]);
}
