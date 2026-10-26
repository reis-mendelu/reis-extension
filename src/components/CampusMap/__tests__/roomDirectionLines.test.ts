import { describe, expect, it } from 'vitest';
import cs from '../../../i18n/locales/cs.json';
import en from '../../../i18n/locales/en.json';
import { directionLines, directionSummary } from '../roomDirectionLines';
import type { Step } from '../../../utils/indoor/roomDirections';

/** A t() over the real locale files, so the test reads what a student reads. */
const tOf =
  (dict: unknown) =>
  (key: string, params: Record<string, string | number> = {}) => {
    const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], dict);
    return String(raw).replace(/\{(\w+)\}/g, (_, k: string) => String(params[k]));
  };

const Q39: Step[] = [
  { kind: 'enter', side: 'east', level: 0 },
  { kind: 'core', side: 'west', lift: true, direction: 'up', level: 3, at: [0, 0] },
  { kind: 'arrive', name: 'Q39', level: 3, byCore: false },
];

describe('directionLines', () => {
  it('reads floor-first, in Czech', () => {
    expect(directionLines(Q39, tOf(cs))).toEqual([
      { kind: 'enter', primary: 'Východní vchod', secondary: 'přízemí' },
      {
        kind: 'up',
        primary: '3. patro',
        secondary: 'po schodech',
        spoken: 'nahoru do 3. patra',
      },
      { kind: 'arrive', primary: 'Q39', secondary: '3. patro' },
    ]);
  });

  // Q has several staircases and their names on the building are not known, so
  // no side or lift is named: the floor is the instruction, the stairs the means.
  it('never names a staircase, its side or its lift', () => {
    const line = directionLines(Q39, tOf(en))[1]!;
    expect(line.secondary).toBe('take the stairs');
    expect(line.secondary).not.toMatch(/west|lift/);
  });

  it('speaks the floor change in English too', () => {
    expect(directionLines(Q39, tOf(en))[1]!.spoken).toBe('up to floor 3');
  });

  it('reads the same in English', () => {
    expect(directionLines(Q39, tOf(en)).map((l) => l.primary)).toEqual([
      'East entrance',
      'floor 3',
      'Q39',
    ]);
  });

  it('goes down to a basement by the stairs, naming none, and says when the room is by them', () => {
    const lines = directionLines(
      [
        { kind: 'enter', side: 'east', level: 0 },
        { kind: 'core', side: 'south', lift: false, direction: 'down', level: -1, at: [0, 0] },
        { kind: 'arrive', name: 'Q01.09', level: -1, byCore: true },
      ],
      tOf(cs)
    );
    expect(lines[1]).toEqual({
      kind: 'down',
      primary: '1. podzemní podlaží',
      secondary: 'po schodech',
      spoken: 'dolů do 1. podzemního podlaží',
    });
    expect(lines[2]!.secondary).toBe('1. podzemní podlaží · hned u schodiště');
  });
});

describe('directionSummary', () => {
  it('fits the way on one line for the closed sheet', () => {
    expect(directionSummary(Q39, tOf(cs))).toBe('Východní vchod · ↑ po schodech');
  });

  it('is just the entrance for a room on the entrance floor', () => {
    expect(
      directionSummary(
        [
          { kind: 'enter', side: 'east', level: 0 },
          { kind: 'arrive', name: 'Q07', level: 0, byCore: false },
        ],
        tOf(cs)
      )
    ).toBe('Východní vchod · přízemí');
  });
});
