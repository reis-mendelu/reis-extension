import type { RefObject } from 'react';
import { usePinchZoom } from './usePinchZoom';
import { useEscapeLayer } from '../../hooks/ui/useEscapeLayer';

/**
 * The reader's input beyond its own buttons: a pinch zooms it (touch; the zoom
 * buttons are the mouse's route), and Escape closes it before whatever it
 * opened over — the subject sheet on the phone tree, the side drawer on the
 * extension — the order Back already keeps.
 */
export function useReaderInput(
  containerRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  scale: number,
  setScale: (scale: number) => void,
  onClose: () => void
) {
  usePinchZoom(containerRef, contentRef, scale, setScale);
  useEscapeLayer(true, onClose);
}
