/**
 * How big the reIS mark has to be drawn on the launch image.
 *
 * The launch image is ONE square, and `LaunchScreen.storyboard` shows it with
 * `contentMode="scaleAspectFill"`. So iOS scales the square until it covers the
 * screen and crops the overhang — which means the mark's size on screen is not
 * the size it was drawn at. It grows with the device's LONGER edge and is then
 * seen against its SHORTER one, so the tallest phone magnifies the mark the
 * most while giving it the least room. Sizing the mark by eye on an iPad is how
 * you ship a logo that fills a third of an iPhone.
 *
 * Pure, and unit tested, because there is exactly one number to get right here
 * and no way to see it wrong without building for every device.
 */

export interface SplashDevice {
  label: string;
  /** Pixels, portrait: the shorter edge. */
  width: number;
  /** Pixels, portrait: the longer edge. */
  height: number;
}

/**
 * The iOS geometries the mark has to survive. The extremes are what matter:
 * the tallest phone sets the mark's size, the shortest tablet is where it can
 * look lost.
 */
export const IOS_DEVICES: SplashDevice[] = [
  { label: 'iPhone 16 Pro Max', width: 1320, height: 2868 },
  { label: 'iPhone 16', width: 1179, height: 2556 },
  { label: 'iPhone SE', width: 750, height: 1334 },
  { label: 'iPad Pro 12.9"', width: 2048, height: 2732 },
  { label: 'iPad 10.2"', width: 1620, height: 2160 },
];

/** `scaleAspectFill`: cover the screen, crop the rest. */
export function aspectFillScale(canvas: number, device: SplashDevice): number {
  return Math.max(device.width, device.height) / canvas;
}

/**
 * What fraction of the device's shorter edge the mark takes up once iOS has
 * scaled the square to cover the screen.
 */
export function markFractionOnDevice(canvas: number, mark: number, device: SplashDevice): number {
  return (mark * aspectFillScale(canvas, device)) / Math.min(device.width, device.height);
}

/**
 * The largest mark, in canvas pixels, that stays within `maxFraction` of the
 * shorter edge on EVERY device — so the binding constraint is the most
 * elongated screen, not the average one.
 *
 * Rounded down to a whole pixel: a fractional draw width would land the mark on
 * a half-pixel and soften an edge that is nothing but straight edges.
 */
export function markSizeForDevices(
  canvas: number,
  devices: SplashDevice[],
  maxFraction: number
): number {
  const worst = Math.max(
    ...devices.map((d) => Math.max(d.width, d.height) / Math.min(d.width, d.height))
  );
  return Math.floor((maxFraction * canvas) / worst);
}
