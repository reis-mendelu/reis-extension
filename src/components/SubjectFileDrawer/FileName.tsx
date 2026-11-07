import { useLayoutEffect, useRef, useState } from 'react';
import { middleTruncate } from '../../utils/documentLabels';

const HAS_EXTENSION = /\.[a-z0-9]{1,8}$/i;
// flex-1: the width is the room the row gives, not the text's, so cutting the
// text cannot shrink the box and trigger another fit.
const CLASSES = 'min-w-0 flex-1 line-clamp-2';

/**
 * A file row's name on up to two lines, its extension never cut.
 *
 * A one-line truncate cut "ig-c04-fyzicka_vrstva.pdf" to "ig-c04-fyzicka_vrstva.p…",
 * and a two-line clamp alone does the same once a name is longer: the clamp
 * cuts the end, where the extension is. On a 320 px phone the name column is
 * about 106 px, eleven characters a line, so most file names need more than
 * two lines.
 *
 * So the name is measured: it stays whole when it fits two lines, otherwise a
 * hidden copy with the same width and classes finds by binary search how much
 * of the stem's middle to drop. It refits when the row's width changes.
 * Without layout (jsdom, the first paint) it is simply the whole name.
 */
export function FileName({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(name);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !HAS_EXTENSION.test(name)) {
      setShown(name);
      return;
    }
    const fit = () => setShown(fitTwoLines(el, name));
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [name]);

  return (
    // A file name breaks anywhere, so two lines hold as much of it as they can
    // ("ig-c04-" alone wasted half a line); a title breaks between words.
    <span
      ref={ref}
      className={`${CLASSES} ${HAS_EXTENSION.test(name) ? 'break-all' : 'break-words'}`}
      title={name}
    >
      {shown}
    </span>
  );
}

/** The longest middle-cut of `name` that fits `el`'s two lines, measured on a hidden copy. */
function fitTwoLines(el: HTMLElement, name: string): string {
  const width = el.clientWidth;
  if (!width || !el.parentElement) return name;
  const probe = el.cloneNode(false) as HTMLElement;
  probe.removeAttribute('title');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${width}px;`;
  el.parentElement.appendChild(probe);
  const fits = (text: string) => {
    probe.textContent = text;
    return probe.scrollHeight <= probe.clientHeight + 1;
  };
  try {
    if (fits(name)) return name;
    let lo = 1;
    let hi = name.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(middleTruncate(name, mid))) lo = mid;
      else hi = mid - 1;
    }
    return middleTruncate(name, lo);
  } finally {
    probe.remove();
  }
}
