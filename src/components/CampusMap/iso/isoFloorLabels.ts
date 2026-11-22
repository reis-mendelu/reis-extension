import { IMG } from '../../../data/map/isoView';

const LABEL_PX = 11;
const LABEL_PX_PER_LETTER = 6;

/**
 * Names the rooms of a floor so they never pile up: constant size on screen, the selected room
 * first (always named), then the rest biggest first (DOM order), each left out if it would land on
 * one already placed or is off screen. `scale` is screen px per picture px; `view` the viewer's bounds.
 */
export function placeLabels(
  g: SVGGElement,
  view: { x: number; y: number },
  scale: number,
  width: number,
  height: number
) {
  g.style.fontSize = `${LABEL_PX / scale}px`;
  g.setAttribute('stroke-width', String(3 / scale));
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const names = Array.from(g.children) as SVGTextElement[];
  const order = [...names.filter((t) => t.dataset.sel), ...names.filter((t) => !t.dataset.sel)];
  for (const t of order) {
    const w = Number(t.dataset.n) * LABEL_PX_PER_LETTER + 4;
    const h = LABEL_PX + 3;
    const x = (Number(t.dataset.x) - view.x * IMG.w) * scale;
    const y = (Number(t.dataset.y) - view.y * IMG.w) * scale;
    const seen = x > -w && y > -h && x < width + w && y < height + h;
    const clear = !taken.some(
      (r) => Math.abs(r.x - x) < (r.w + w) / 2 && Math.abs(r.y - y) < (r.h + h) / 2
    );
    const show = !!t.dataset.sel || (seen && clear);
    t.style.display = show ? '' : 'none';
    if (show) taken.push({ x, y, w, h });
  }
}
