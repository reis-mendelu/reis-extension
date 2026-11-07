import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import { middleTruncate, nameBreaks } from '../../utils/documentLabels';

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

  if (!HAS_EXTENSION.test(name)) {
    // A title breaks between words.
    return (
      <span ref={ref} className={`${CLASSES} break-words`} title={name}>
        {shown}
      </span>
    );
  }
  // A file name breaks after its separators (<wbr>), anywhere only as a last
  // resort, and never inside the extension: break-all split
  // "ig-PPS-org-inf-ZS2026.pdf" into "…ZS2026.p" / "df".
  const { pieces, tail } = nameBreaks(shown);
  return (
    <span ref={ref} className={`${CLASSES} ${FILE_NAME_WRAP}`} title={name}>
      {pieces.map((piece, i) => (
        <Fragment key={i}>
          {piece}
          <wbr />
        </Fragment>
      ))}
      <span className="whitespace-nowrap">{tail}</span>
    </span>
  );
}

const FILE_NAME_WRAP = '[overflow-wrap:anywhere]';

/** The same markup FileName renders, built on the hidden probe. */
function fillProbe(probe: HTMLElement, text: string) {
  probe.replaceChildren();
  const { pieces, tail } = nameBreaks(text);
  for (const piece of pieces) {
    probe.append(piece, document.createElement('wbr'));
  }
  const glued = document.createElement('span');
  glued.className = 'whitespace-nowrap';
  glued.textContent = tail;
  probe.append(glued);
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
    fillProbe(probe, text);
    // Wider counts too: the glued tail cannot wrap, so it can only overflow.
    return (
      probe.scrollHeight <= probe.clientHeight + 1 && probe.scrollWidth <= probe.clientWidth + 1
    );
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
