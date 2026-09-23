'use client';

import type { CSSProperties, ReactNode } from 'react';
import { Check, CircleAlert, Info, TriangleAlert } from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useAppStore } from '../../store/useAppStore';

/*
 * Sonner injects its stylesheet unlayered, and Tailwind v4 puts every utility
 * in `@layer utilities` — so any class aimed at the toast loses, and for its
 * whole life this wrapper's `bg-base-100 rounded-xl` classes applied nothing:
 * the toast was sonner's own black #000 pill in both themes. Its custom
 * properties are what its rules actually read, so the DaisyUI tokens go in
 * there, inline, and follow `data-theme` on their own.
 */
const SURFACE = {
  '--normal-bg': 'var(--color-base-100)',
  // A hairline, not a tone: base-100 on base-200 is 1.08:1 in the light
  // theme, and over the near-white basemap on Mapa it is nothing at all.
  '--normal-border': 'color-mix(in oklab, var(--color-base-content) 10%, transparent)',
  '--normal-text': 'var(--color-base-content)',
  '--border-radius': 'var(--radius-box)',
  fontFamily: 'inherit',
} as CSSProperties;

// Inline on each toast for the same reason SURFACE is inline.
const TOAST_STYLE: CSSProperties = {
  padding: '10px 14px 10px 10px',
  gap: '10px',
  fontSize: 'var(--text-sm)',
  boxShadow: 'var(--shadow-popup)',
};

/*
 * The glyph sits on a /15 tint of its own hue, in the darkened --tone-* ink —
 * the same material as the app's tonal buttons and status badges. The raw
 * semantic hues fail AA on base-100 (`text-error` is 3.90:1); the tones clear it.
 */
function Tone({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span
      data-toast-tone={tone}
      className={`grid size-7 place-items-center rounded-full ${TINT[tone]}`}
    >
      {children}
    </span>
  );
}

const TINT: Record<string, string> = {
  success: 'bg-success/15 text-[var(--tone-success)]',
  error: 'bg-error/15 text-[var(--tone-error)]',
  warning: 'bg-warning/15 text-[var(--tone-warning)]',
  info: 'bg-info/15 text-[var(--tone-info)]',
};

const ICON = 'size-4';
const ICONS: ToasterProps['icons'] = {
  success: (
    <Tone tone="success">
      <Check className={ICON} strokeWidth={3} />
    </Tone>
  ),
  error: (
    <Tone tone="error">
      <CircleAlert className={ICON} strokeWidth={2.5} />
    </Tone>
  ),
  warning: (
    <Tone tone="warning">
      <TriangleAlert className={ICON} strokeWidth={2.5} />
    </Tone>
  ),
  info: (
    <Tone tone="info">
      <Info className={ICON} strokeWidth={2.5} />
    </Tone>
  ),
};

const Toaster = ({ ...props }: ToasterProps) => {
  // The app's theme, not the OS's: `system` put a black toast on the light theme.
  const theme = useAppStore((s) => s.theme) === 'mendelu' ? 'light' : 'dark';
  return (
    <Sonner
      theme={theme}
      visibleToasts={1}
      icons={ICONS}
      style={SURFACE}
      toastOptions={{
        style: TOAST_STYLE,
        // Sonner's icon slot is a fixed 16px box; the chip is 28px. Trailing
        // `!` because a plain utility loses to sonner's unlayered rule.
        classNames: { icon: 'size-7! m-0!', title: 'leading-snug!' },
      }}
      {...props}
    />
  );
};

export { Toaster };
