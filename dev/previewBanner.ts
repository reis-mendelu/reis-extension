import type { HarnessEnv } from './harnessEnabled';

const BANNER_ID = 'reis-preview-banner';

/**
 * Whether to paint the preview banner.
 *
 * Preview builds only — not local `dev:web`. Locally you already know it is
 * local, and a permanent bar across the top would sit in every screenshot
 * scripts/shot.ts takes.
 */
export function shouldShowPreviewBanner(env: HarnessEnv): boolean {
  return env.VITE_PREVIEW_BUILD === 'true';
}

/**
 * Appends a non-dismissible bar naming the two things about this deployment
 * that are expensive to forget: the data is synthetic, and writes go to an
 * in-memory store, so a publish that looks like it worked here proves nothing.
 *
 * Plain DOM rather than a React component, and in dev/ rather than src/, so it
 * cannot be imported into the shipped app by accident.
 */
export function mountPreviewBanner(env: HarnessEnv, doc: Document = document): void {
  if (!shouldShowPreviewBanner(env)) return;
  if (doc.getElementById(BANNER_ID)) return;

  const banner = doc.createElement('div');
  banner.id = BANNER_ID;
  banner.dataset.testid = 'preview-banner';
  // bottom-24 (96px) rather than bottom-0: the mobile BottomNav pill floats at
  // bottom-[18px] and is ~56px tall (top edge ~74px from the viewport bottom),
  // so a flush bottom-0 strip painted over its lower edge. bottom-24 clears it
  // with room to spare and doesn't collide with anything else pinned to the
  // top (ScreenHeader/DemoBanner) or bottom (desktop has nothing there).
  banner.className =
    'fixed bottom-24 inset-x-0 z-50 bg-warning text-warning-content text-xs text-center px-3 py-1';
  banner.textContent =
    'Preview build — Sample data, not a real student. Changes here are not saved.';
  doc.body.appendChild(banner);
}
