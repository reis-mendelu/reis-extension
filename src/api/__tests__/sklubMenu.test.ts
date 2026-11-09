import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSklubMenu } from '../sklubMenu';

/**
 * A trimmed real capture of https://sklubpixie.cz/page-4 (2026-11-09): the
 * site is one Canva page bundle, and the week's menu is a JSON string array
 * inside it. Their public menu — no people in it.
 */
const FRAGMENT = readFileSync(
  resolve(__dirname, 'fixtures/sklub-pixie-page4.fragment.txt'),
  'utf8'
);

describe('parseSklubMenu — the real page', () => {
  const days = parseSklubMenu(FRAGMENT);

  it('finds Monday to Friday of the week in the heading', () => {
    expect(days.map((d) => d.date)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ]);
  });

  it('reads the soup without its allergens', () => {
    expect(days[0]!.soup).toBe('Dýňový krém s mrkví');
    expect(days[4]!.soup).toBe('Gulášová polévka');
  });

  it('reads four dishes a day, weight kept, letter and allergens dropped', () => {
    expect(days.every((d) => d.dishes.length === 4)).toBe(true);
    expect(days[0]!.dishes[0]).toBe(
      '150g Kuřecí prsíčko plněné chedarem a sušenou šunkou, šťouchané brambory'
    );
    // A line with a leading space (" B) 160g …" on Wednesday) still counts.
    expect(days[2]!.dishes[1]).toBe(
      '160g Vepřové čevapčiči s cibulovým salátkem, vařeným bramborem a hořčicí'
    );
  });

  it('keeps brackets that are part of the dish', () => {
    expect(days[3]!.dishes[2]).toMatch(/^300g Bún bo` Nam Bô \(vietnamský salát/);
  });
});

describe('parseSklubMenu — what it refuses', () => {
  it('a page without the menu is no menu', () => {
    expect(parseSklubMenu('<html><body>S-klub</body></html>')).toEqual([]);
  });

  it('a heading it cannot date is no menu, not a wrongly dated one', () => {
    expect(parseSklubMenu('{"A":["Menu tento týden \\\\n","Pondělí: Polévka (1)\\\\n"]}')).toEqual(
      []
    );
  });

  it('a week that crosses a month', () => {
    const page =
      '{"A":["Menu 30.11.-4.12 2026 \\\\n","Pondělí: Vývar (1)\\\\n","A) 100g Jídlo (1)\\\\n",' +
      '"Pátek: Krém (7)\\\\n","A) 200g Jiné (3)\\\\n"]}';
    expect(parseSklubMenu(page)).toEqual([
      { date: '2026-11-30', soup: 'Vývar', dishes: ['100g Jídlo'] },
      { date: '2026-12-04', soup: 'Krém', dishes: ['200g Jiné'] },
    ]);
  });
});
