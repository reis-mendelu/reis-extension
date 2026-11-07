import { useLayoutEffect, useRef, useState } from 'react';
import { middleCut } from '../../utils/documentLabels';

// flex-1: the width is the room the row gives, not the text's, so cutting the
// text cannot shrink the box and trigger another fit.
const CLASSES = 'min-w-0 flex-1 line-clamp-2 break-words';

/**
 * A file row's name as a student reads it, on up to two lines.
 *
 * `shown` is the cleaned text FileList computed (shownNames: no extension,
 * separators as spaces, the extension back only where two rows would read the
 * same); `name` is the real one and stays in `title`. The reader, saved files
 * and reIS for Claude get the real name from the row, not from here.
 *
 * Past two lines the middle is cut ("ig organizac…novani"), measured on a
 * hidden copy with the same width and classes, refitting when the width
 * changes. Without layout (jsdom, the first paint) it is the whole text.
 */
export function FileName({ name, shown }: { name: string; shown?: string }) {
  const pretty = shown ?? name;
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(pretty);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => setVisible(fitTwoLines(el, pretty));
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
  }, [pretty]);

  return (
    <span ref={ref} className={CLASSES} title={name}>
      <FileNameText shown={visible} full={pretty} />
    </span>
  );
}

/**
 * The visible name, and the whole one for screen readers when the visible one
 * is cut: a reader would otherwise announce "ig organizac … novani".
 */
export function FileNameText({ shown, full }: { shown: string; full: string }) {
  if (shown === full) return <>{full}</>;
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{full}</span>
    </>
  );
}

/** The longest middle cut of `text` that fits `el`'s two lines, measured on a hidden copy. */
function fitTwoLines(el: HTMLElement, text: string): string {
  const width = el.clientWidth;
  if (!width || !el.parentElement) return text;
  const probe = el.cloneNode(false) as HTMLElement;
  probe.removeAttribute('title');
  probe.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${width}px;`;
  el.parentElement.appendChild(probe);
  const fits = (candidate: string) => {
    probe.textContent = candidate;
    return (
      probe.scrollHeight <= probe.clientHeight + 1 && probe.scrollWidth <= probe.clientWidth + 1
    );
  };
  try {
    if (fits(text)) return text;
    let lo = 1;
    let hi = text.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (fits(middleCut(text, mid))) lo = mid;
      else hi = mid - 1;
    }
    return middleCut(text, lo);
  } finally {
    probe.remove();
  }
}
