import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FileName } from '../FileName';

/**
 * jsdom has no layout, so this fakes one: a 100 px box two lines high, where
 * any text over 20 characters needs a third line. That is enough to prove the
 * fit cuts the middle, keeps the ending, and stops at what fits.
 */
function fakeLayout() {
  const proto = HTMLElement.prototype;
  const spies = [
    vi.spyOn(proto, 'clientWidth', 'get').mockReturnValue(100),
    vi.spyOn(proto, 'scrollWidth', 'get').mockReturnValue(100),
    vi.spyOn(proto, 'clientHeight', 'get').mockReturnValue(40),
    vi.spyOn(proto, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return Array.from(this.textContent ?? '').length > 20 ? 60 : 40;
    }),
  ];
  return () => spies.forEach((s) => s.mockRestore());
}

afterEach(cleanup);

describe('FileName fitting', () => {
  it('cuts the middle of a name that needs a third line, keeping both ends', () => {
    const restore = fakeLayout();
    try {
      render(<FileName name="raw.pdf" shown="ig organizacni informace kombinovani" />);
      const visible = screen.getByText(/…/);
      expect(Array.from(visible.textContent ?? '').length).toBe(20);
      expect(visible.textContent?.startsWith('ig organiz')).toBe(true);
      expect(visible.textContent?.endsWith('novani')).toBe(true);
      expect(screen.getByText('ig organizacni informace kombinovani')).toHaveClass('sr-only');
    } finally {
      restore();
    }
  });

  it('leaves a name that fits whole', () => {
    const restore = fakeLayout();
    try {
      render(<FileName name="eth_frame.pdf" shown="eth frame" />);
      expect(screen.getByTitle('eth_frame.pdf')).toHaveTextContent(/^eth frame$/);
    } finally {
      restore();
    }
  });
});

describe('FileName after the web font loads', () => {
  it('fits again once document.fonts is ready', async () => {
    let fontsLoaded!: () => void;
    const ready = new Promise<void>((resolve) => (fontsLoaded = resolve));
    const fonts = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } });
    let wide = false; // the fallback font fits; Inter's wider glyphs do not
    const proto = HTMLElement.prototype;
    const spies = [
      vi.spyOn(proto, 'clientWidth', 'get').mockReturnValue(100),
      vi.spyOn(proto, 'scrollWidth', 'get').mockReturnValue(100),
      vi.spyOn(proto, 'clientHeight', 'get').mockReturnValue(40),
      vi.spyOn(proto, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return wide && Array.from(this.textContent ?? '').length > 20 ? 60 : 40;
      }),
    ];
    try {
      render(<FileName name="raw.pdf" shown="ig organizacni informace kombinovani" />);
      expect(screen.queryByText(/…/)).toBeNull();
      wide = true;
      fontsLoaded();
      expect(await screen.findByText(/…/)).toBeInTheDocument();
    } finally {
      spies.forEach((s) => s.mockRestore());
      if (fonts) Object.defineProperty(document, 'fonts', fonts);
      else Reflect.deleteProperty(document, 'fonts');
    }
  });
});
