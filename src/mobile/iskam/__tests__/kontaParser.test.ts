import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseHlavniKonto } from '../kontaParser';

const fixture = readFileSync(resolve(__dirname, 'fixtures/konta.html'), 'utf8');
const row = (name: string, amount: string, href = '') =>
  `<div class="row vyskaRiadkuKonto"><div>${name}</div><div>${amount}</div>${
    href ? `<a href="${href}">Nabít</a>` : ''
  }</div>`;

describe('parseHlavniKonto', () => {
  it('reads the Hlavní konto row by its NabitiKonta/0 link, with an NBSP thousands separator', () => {
    expect(parseHlavniKonto(fixture)).toEqual({ amount: 1234.56 });
  });

  it('finds the row by link even when the name is translated', () => {
    expect(parseHlavniKonto(row('Main account', '12,00 Kč', '/Platby/NabitiKonta/0'))?.amount).toBe(
      12
    );
  });

  it('falls back to the name when the top-up link is missing', () => {
    expect(parseHlavniKonto(row('Hlavní konto', '0 Kč'))?.amount).toBe(0);
  });

  // Measured on a Pixel 9a, 2026-10-13: a phone set to English gets WebISKAM in
  // English (`<html lang="en">`, "Main account"), and the amount comes as
  // "N,NNN.NN Kč" — comma thousands, dot decimals. Read as Czech, that was null.
  it('reads the English page, where the comma is the thousands separator', () => {
    const en = (amount: string) =>
      `<html lang="en"><body>${row('Main account', amount, '/Platby/NabitiKonta/0')}</body></html>`;
    expect(parseHlavniKonto(en('1,234.56 Kč'))?.amount).toBe(1234.56);
    expect(parseHlavniKonto(en('5,000 Kč'))?.amount).toBe(5000);
    expect(parseHlavniKonto(en('-12.00 Kč'))?.amount).toBe(-12);
    expect(parseHlavniKonto(en('0 Kč'))?.amount).toBe(0);
  });

  it('reads a Czech page as Czech even when it says so explicitly', () => {
    const cs = `<html lang="cs"><body>${row('Hlavní konto', '1 234,56 Kč', '/Platby/NabitiKonta/0')}</body></html>`;
    expect(parseHlavniKonto(cs)?.amount).toBe(1234.56);
  });

  // Review finding I1: with a format-agnostic pattern, a page whose lang and
  // number format disagreed read "5,000 Kč" as 5 and "234,56 Kč" as 23456 —
  // a wrong number beside a Dobít button. Each format now matches only itself;
  // anything ambiguous is null ("unavailable"), never a guess.
  it('returns null, never a wrong number, when the format does not match the page language', () => {
    const page = (lang: string, amount: string) =>
      `<html lang="${lang}"><body>${row('x', amount, '/Platby/NabitiKonta/0')}</body></html>`;
    expect(parseHlavniKonto(page('cs', '5,000 Kč'))).toBeNull();
    expect(parseHlavniKonto(page('cs', '1,234 Kč'))).toBeNull();
    expect(parseHlavniKonto(page('en', '234,56 Kč'))).toBeNull();
    expect(parseHlavniKonto(page('en', '12,00 Kč'))).toBeNull();
    expect(parseHlavniKonto(page('en', '1 234.56 Kč'))).toBeNull();
    expect(parseHlavniKonto(page('cs', '5 000 Kč'))?.amount).toBe(5000);
    expect(parseHlavniKonto(page('en', '12.5 Kč'))?.amount).toBe(12.5);
  });

  it('reads a negative balance', () => {
    expect(
      parseHlavniKonto(row('Hlavní konto', '-12,00 Kč', '/Platby/NabitiKonta/0'))?.amount
    ).toBe(-12);
  });

  it('never returns a different account (NabitiKonta/2 is the reservation deposit)', () => {
    expect(parseHlavniKonto(row('Rezervační kauce', '700 Kč', '/Platby/NabitiKonta/2'))).toBeNull();
  });

  it('returns null rather than a guess when the amount cannot be read', () => {
    expect(parseHlavniKonto(row('Hlavní konto', 'n/a', '/Platby/NabitiKonta/0'))).toBeNull();
    expect(parseHlavniKonto('<html><body>login</body></html>')).toBeNull();
  });
});
