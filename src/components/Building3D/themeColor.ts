/**
 * Resolve a DaisyUI colour class to a hex three.js can take. The theme's
 * colours are CSS variables in oklch, which `THREE.Color` cannot parse, so the
 * browser does the conversion: paint the computed colour onto a 1×1 canvas and
 * read the pixel back.
 */
export function resolveThemeColor(host: HTMLElement, className: string, fallback: string): string {
  const probe = document.createElement('span');
  probe.className = className;
  probe.style.display = 'none';
  host.appendChild(probe);
  try {
    const css = getComputedStyle(probe).backgroundColor;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!css || !ctx) return fallback;
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return fallback;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return fallback;
  } finally {
    probe.remove();
  }
}
