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
    expect(parseHlavniKonto(fixture)).toEqual({ amount: 1234.56, text: '1 234,56 Kč' });
  });

  it('finds the row by link even when the name is translated', () => {
    expect(parseHlavniKonto(row('Main account', '12,00 Kč', '/Platby/NabitiKonta/0'))?.amount).toBe(
      12
    );
  });

  it('falls back to the name when the top-up link is missing', () => {
    expect(parseHlavniKonto(row('Hlavní konto', '0 Kč'))?.amount).toBe(0);
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
