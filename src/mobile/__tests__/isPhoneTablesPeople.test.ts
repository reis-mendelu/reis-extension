import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { $, $$, IS_PAGE, PEOPLE, SIMPLE, page, run, setUrl, size } from './isPhoneTablesFixtures';

/**
 * Card rows that carry a photo (Moji spolužáci, people lists) get a layout of
 * their own: thumbnail on the left, the rest beside it. The rule is generic,
 * read from the cells, never from the page: a big picture with no text is a
 * photo, and a bare number under an empty header is a row number.
 */
describe('the phone script and card rows with a photo', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    setUrl(IS_PAGE);
    Object.defineProperty(window.screen, 'width', { value: 390, configurable: true });
    Object.defineProperty(window.screen, 'height', { value: 844, configurable: true });
  });
  afterEach(() => setUrl('http://localhost:3000/'));

  it('marks the photo, the row number and the row itself', () => {
    document.body.innerHTML = page(PEOPLE);
    size('#t', 900);
    run();
    expect($('#t').classList.contains('reis-cards')).toBe(true);
    const row = $$('#t tr')[1]!;
    expect(row.classList.contains('reis-person')).toBe(true);
    const cells = [...row.children] as HTMLElement[];
    expect(cells[0]!.classList.contains('reis-num')).toBe(true);
    expect(cells[1]!.classList.contains('reis-photo')).toBe(true);
    expect(cells[2]!.classList.contains('reis-title')).toBe(true);
    // The e-mail icon is an icon, not a photo.
    expect(cells[4]!.classList.contains('reis-photo')).toBe(false);
    expect(cells[4]!.classList.contains('reis-icon')).toBe(true);
  });

  it('leaves rows with only small icons as plain cards', () => {
    document.body.innerHTML = page(SIMPLE);
    size('#t', 900);
    run();
    expect($$('#t .reis-person, #t .reis-photo, #t .reis-num')).toHaveLength(0);
  });

  it('touches nothing when the people table fits', () => {
    document.body.innerHTML = page(PEOPLE);
    size('#t', 380);
    const before = document.body.innerHTML;
    run();
    expect(document.body.innerHTML).toBe(before);
  });
});
