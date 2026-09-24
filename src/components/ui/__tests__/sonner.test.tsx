import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toast } from 'sonner';
import { Toaster } from '../sonner';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => {
  act(() => toast.dismiss());
  cleanup();
  useAppStore.setState({ theme: 'mendelu-dark' });
});

function toaster(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-sonner-toaster]');
  if (!el) throw new Error('no toaster mounted');
  return el;
}

describe('Toaster', () => {
  // Sonner's stylesheet is unlayered, so a Tailwind class on the toast loses to
  // it: the toast rendered sonner's black #000 in both themes. Its own custom
  // properties are the only surface that reliably wins, set inline.
  it('paints the toast with the DaisyUI surface, not sonner defaults', async () => {
    render(<Toaster />);
    act(() => toast.success('Uloženo do Stažených'));
    await screen.findByText('Uloženo do Stažených');
    const style = toaster().style;
    expect(style.getPropertyValue('--normal-bg')).toBe('var(--color-base-100)');
    expect(style.getPropertyValue('--normal-text')).toBe('var(--color-base-content)');
    expect(style.getPropertyValue('--border-radius')).toBe('var(--radius-box)');
  });

  it("follows the app's theme, not the operating system's", async () => {
    useAppStore.setState({ theme: 'mendelu' });
    render(<Toaster />);
    act(() => toast.error('x'));
    await screen.findByText('x');
    expect(toaster().getAttribute('data-sonner-theme')).toBe('light');
  });

  it('marks each type with its own tonal icon', async () => {
    render(<Toaster />);
    act(() => toast.error('Soubor se nepodařilo stáhnout.'));
    const title = await screen.findByText('Soubor se nepodařilo stáhnout.');
    const icon = title.closest('[data-sonner-toast]')?.querySelector('[data-toast-tone]');
    expect(icon?.getAttribute('data-toast-tone')).toBe('error');
  });

  // The old block forced `white-space: nowrap !important`, so a long Czech
  // error ran off a 320px phone instead of wrapping.
  it('does not force toast text onto one line', () => {
    const css = readFileSync(resolve(__dirname, '../../../index.css'), 'utf8');
    expect(css).not.toMatch(/\[data-sonner-toast\]/);
  });
});
