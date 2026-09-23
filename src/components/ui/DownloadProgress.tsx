/**
 * The one download indicator, used wherever a student waits for a file.
 *
 * It is deliberately ONE component with two faces rather than two components:
 * whether a percentage exists is a property of the server's answer, not of the
 * platform or the screen. IS sends Content-Length for stored files and nothing
 * for the PDFs it generates on the fly, and the Capacitor transport can report
 * no bytes at all — so the same row shows a ring on the extension and a spinner
 * on the phone for the same tap. Both occupy the same box, so nothing reflows
 * when one becomes the other.
 */

import type { CSSProperties } from 'react';
import type { DownloadTick } from '../../hooks/ui/readBlobWithProgress';

export interface DownloadProgressProps {
  tick: DownloadTick | null | undefined;
  /** Announced to screen readers — the row's button has only an icon. */
  label: string;
  className?: string;
}

/** Whole percent, or null while the total is unknown. Not exported: this file
 *  exports components only, which is what keeps fast refresh working. */
function percentOf(tick: DownloadTick | null | undefined): number | null {
  if (!tick || !tick.total) return null;
  return Math.max(0, Math.min(100, Math.round((tick.loaded / tick.total) * 100)));
}

export function DownloadProgress({ tick, label, className = '' }: DownloadProgressProps) {
  const percent = percentOf(tick);

  // `--btn-tonal-primary`, which is this project's answer for green used as an
  // affordance: raw primary in dark, mixed 62% toward black in light. Raw
  // `text-primary` measured 6.42:1 on the dark row but only 2.29:1 on the light
  // theme's white — against 20.99:1 for the Download icon it replaces, i.e.
  // present but invisible. Flattening to `text-base-content` also passes and
  // was tried first, but it throws the brand green away for no reason: the
  // token keeps it and reads in both themes.
  if (percent === null) {
    return (
      <span
        role="progressbar"
        aria-label={label}
        data-testid="download-progress"
        className={`loading loading-spinner loading-xs text-[var(--btn-tonal-primary)] ${className}`}
      />
    );
  }

  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid="download-progress"
      className={`radial-progress text-[var(--btn-tonal-primary)] ${className}`}
      // DaisyUI's documented API for radial-progress — the custom properties
      // ARE the component's interface, not app CSS of our own.
      style={
        {
          '--value': percent,
          '--size': '1rem',
          '--thickness': '2px',
        } as CSSProperties
      }
    />
  );
}
