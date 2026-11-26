import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isDashboardPath, isReisOff, openInRealIs } from '../reisOff';

/**
 * "Otevřít v IS" has to open IS. In the extension the content script injects
 * reIS on IS's home page, so a link there just reopens reIS: an IS outage
 * notice (no link of its own) sent the student back to the app they were
 * trying to get out of. The marker is a URL fragment, which never reaches IS.
 */
describe('openInRealIs', () => {
  it('marks IS home, the one page the content script injects on', () => {
    expect(openInRealIs('https://is.mendelu.cz/auth/index.pl')).toBe(
      'https://is.mendelu.cz/auth/index.pl#reis-off'
    );
    expect(openInRealIs('https://is.mendelu.cz/auth/?lang=cz')).toBe(
      'https://is.mendelu.cz/auth/?lang=cz#reis-off'
    );
    expect(openInRealIs('https://is.mendelu.cz/auth/index.pl?lang=en;x=1')).toContain('#reis-off');
  });

  it('leaves every other IS page and every other host alone', () => {
    for (const url of [
      'https://is.mendelu.cz/auth/student/list.pl?studium=1;obdobi=2;predmet=3;test=1',
      'https://is.mendelu.cz/auth/kontrola/',
      'https://is.mendelu.cz/system/login.pl',
      'https://example.com/auth/index.pl',
      'https://is.mendelu.cz.evil.com/auth/index.pl',
    ]) {
      expect(openInRealIs(url)).toBe(url);
    }
  });

  it('keeps a fragment the link already had and survives garbage', () => {
    expect(openInRealIs('https://is.mendelu.cz/auth/index.pl#x')).toBe(
      'https://is.mendelu.cz/auth/index.pl#x'
    );
    expect(openInRealIs('not a url')).toBe('not a url');
  });
});

describe('isReisOff', () => {
  it('is true only for the marker', () => {
    expect(isReisOff('#reis-off')).toBe(true);
    expect(isReisOff('')).toBe(false);
    expect(isReisOff('#something')).toBe(false);
  });
});

describe('isDashboardPath', () => {
  it('is the page the sniper injects on', () => {
    expect(isDashboardPath('/auth/')).toBe(true);
    expect(isDashboardPath('/auth/index.pl')).toBe(true);
    expect(isDashboardPath('/auth/student/list.pl')).toBe(false);
  });
});

describe('the content script and the marker agree', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/entrypoints/content.ts'), 'utf8');
  const patterns = [...src.matchAll(/'(https:\/\/is\.mendelu\.cz\/[^']*)'/g)].map((m) => m[1]!);

  it('reads its match patterns', () => {
    expect(patterns.length).toBeGreaterThan(0);
  });

  it.each(patterns)('a page matched by %s can be opened without reIS', (pattern) => {
    const sample = pattern.replace(/\*/g, '');
    expect(isReisOff(new URL(openInRealIs(sample)).hash)).toBe(true);
  });

  it('the content script checks the marker before it hides the page or syncs', () => {
    const check = src.indexOf('isReisOff(');
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(src.indexOf("style.visibility = 'hidden'"));
    expect(check).toBeLessThan(src.indexOf('startInjection()'));
    expect(check).toBeLessThan(src.indexOf('startBgPokeListener()'));
  });
});
