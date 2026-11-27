import { describe, expect, it } from 'vitest';
import { pageText } from '../pageText';

describe('pageText', () => {
  it('turns markup into one line per block, cells tab-separated, entities decoded', () => {
    const html =
      '<h1>Moje&nbsp;studium</h1><table><tr><td>EBC-ALG</td><td>A &amp; B</td></tr></table>' +
      '<p>a<br>b</p><ul><li>x&#160;y</li></ul>';
    expect(pageText(html)).toBe('Moje studium\nEBC-ALG\tA & B\na\nb\nx y');
  });

  it('drops scripts, styles, comments and hidden inputs (tokens live there)', () => {
    const html =
      '<script>var t = 1732700000;</script><style>.a{}</style><!-- 12:00 -->' +
      '<input type="hidden" name="__RequestVerificationToken" value="abc"><p>Konto</p>';
    expect(pageText(html)).toBe('Konto');
  });

  it("drops IS's header block: today's name day, the clock and the student's name", () => {
    const at = (when: string, nameDay: string) =>
      `<div class="right"><div class="info"><div >${nameDay}</div><div title="">${when}</div>` +
      '<div class="dvdr"></div><div >Dominik Holek</div></div></div><p>Zkoušky</p>';
    const a = pageText(at('15. 11. 2026&nbsp;23:00', 'Leopold'));
    const b = pageText(at('16. 11. 2026&nbsp;07:00', 'Otmar'));
    expect(a).toBe('Zkoušky');
    expect(b).toBe(a);
  });
});

describe('pageText on IS pages', () => {
  it("keeps only IS's main column: the menu's unread badge and the header stay out", () => {
    const html =
      '<div class="wholepage"><span>Dokumentový server</span><span class="badge">436</span>' +
      '<div class="mainpage"><h1>Přihlašování na zkoušky</h1></div></div>';
    expect(pageText(html)).toBe('Přihlašování na zkoušky');
  });

  it("drops the home page's live usage counters, in both languages", () => {
    const html =
      '<div class="mainpage"><p>Vývěska</p>' +
      '<p>V Univerzitním informačním systému bylo od 29. února 2000 provedeno celkem 2 423 007 713 operací.</p>' +
      '<p>Včera bylo přihlášeno 3 537 uživatelů a bylo provedeno 1 556 074 operací.</p>' +
      '<p>Na serveru v posledních 5 minutách pracovalo 139 uživatelů a bylo provedeno 4 112 operací.</p>' +
      '<p>Yesterday 3 537 users logged in and 1 556 074 operations were performed.</p>' +
      '<p>In the last 5 minutes 139 users worked on the server.</p></div>';
    expect(pageText(html)).toBe('Vývěska');
  });
});

describe('pageText on broken markup', () => {
  it('leaves no tag fragment, even from nested or unclosed tags', () => {
    expect(pageText('<scr<script>x</script>ipt>alert(1)</script><p>Konto</p>')).not.toMatch(/</);
    expect(pageText('<p>a</p><div')).toBe('a');
  });
});
