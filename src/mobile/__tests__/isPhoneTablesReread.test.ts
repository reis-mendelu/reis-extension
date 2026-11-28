import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { $, IS_PAGE, SIMPLE, page, run, setUrl, size } from './isPhoneTablesFixtures';

/**
 * The order tables are read in, and reading them again when the phone is
 * turned. Split from isPhoneTables.test.ts, which covers each treatment.
 */
describe('the phone script re-reading IS tables', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    setUrl(IS_PAGE);
    Object.defineProperty(window.screen, 'width', { value: 390, configurable: true });
    Object.defineProperty(window.screen, 'height', { value: 844, configurable: true });
  });
  afterEach(() => setUrl('http://localhost:3000/'));

  // A layout table is wide only because of the table inside it. Inner first,
  // or the outer one is squeezed for a problem the inner cards have solved.
  it('reads an inner table before the layout table around it', () => {
    document.body.innerHTML = page(
      `<table id="outer"><tr><td>Filtr</td></tr><tr><td>${SIMPLE}</td></tr></table>`
    );
    size('#t', 900);
    const outer = $('#outer');
    Object.defineProperty(outer, 'scrollWidth', {
      get: () => ($('#t').classList.contains('reis-cards') ? 380 : 900),
      configurable: true,
    });
    Object.defineProperty(outer, 'clientWidth', { get: () => 380, configurable: true });
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(true);
    expect(outer.className).toBe('');
  });

  it('never makes cards of a table that holds other tables', () => {
    document.body.innerHTML = page(
      '<table id="t"><tr><th>A</th><th>B</th></tr><tr><td><table><tr><td>x</td></tr></table></td><td>y</td></tr></table>'
    );
    size('#t', 900);
    run();
    expect($('#t').className).toBe('reis-compact');
  });

  it('judges again when the phone is turned, and undoes what no longer applies', () => {
    document.body.innerHTML = page(SIMPLE);
    size('#t', 900);
    const root = document.documentElement;
    Object.defineProperty(root, 'clientWidth', { get: () => 390, configurable: true });
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(true);

    size('#t', 700, 844);
    window.dispatchEvent(new Event('resize'));
    expect($('#t').classList.contains('reis-cards')).toBe(true); // same width: a keyboard, not a turn

    Object.defineProperty(root, 'clientWidth', { get: () => 844, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect($('#t').classList.contains('reis-cards')).toBe(false);
  });
  // IS's web font can arrive after the page has loaded and change how wide a
  // table is. Judged with the fallback font, a table that will not fit looked
  // as if it did, and then scrolled sideways for good.
  it('judges again once the fonts have loaded', async () => {
    let loaded = () => {};
    const ready = new Promise<void>((resolve) => {
      loaded = resolve;
    });
    Object.defineProperty(document, 'fonts', { value: { ready }, configurable: true });
    document.body.innerHTML = page(SIMPLE);
    size('#t', 380);
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(false);

    size('#t', 900);
    loaded();
    await ready;
    await Promise.resolve();
    expect($('#t').classList.contains('reis-cards')).toBe(true);
    Reflect.deleteProperty(document, 'fonts');
  });

  // `fonts.ready` is read when the script starts, at document start, before
  // the page has asked for any font, so it can resolve at once (seen on the
  // classmates list: 1 render in 25 kept a wide table). A font later than
  // that is caught by `loadingdone` where the browser has it...
  it('judges again when a font finishes loading after fonts.ready', async () => {
    const fonts = new EventTarget() as EventTarget & { ready: Promise<void> };
    fonts.ready = Promise.resolve();
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
    document.body.innerHTML = page(SIMPLE);
    size('#t', 380);
    run();
    await Promise.resolve();
    await Promise.resolve();
    expect($('#t').classList.contains('reis-cards')).toBe(false);

    size('#t', 900);
    fonts.dispatchEvent(new Event('loadingdone'));
    expect($('#t').classList.contains('reis-cards')).toBe(true);
    Reflect.deleteProperty(document, 'fonts');
  });

  // ...and, where it does not (Safari's is recent and incomplete), by reading
  // fonts.ready again one frame after `load`, once the text has asked for them.
  it('reads fonts.ready again after load, without loadingdone', async () => {
    let loaded = () => {};
    const fonts: { ready: Promise<void> } = { ready: Promise.resolve() };
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
    document.body.innerHTML = page(SIMPLE);
    size('#t', 380);
    run();
    await Promise.resolve();
    await Promise.resolve();

    fonts.ready = new Promise<void>((resolve) => {
      loaded = resolve;
    });
    window.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect($('#t').classList.contains('reis-cards')).toBe(false);

    size('#t', 900);
    loaded();
    await fonts.ready;
    await Promise.resolve();
    expect($('#t').classList.contains('reis-cards')).toBe(true);
    Reflect.deleteProperty(document, 'fonts');
  });
});
