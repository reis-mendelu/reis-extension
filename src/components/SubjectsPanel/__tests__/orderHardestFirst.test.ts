import { describe, it, expect } from 'vitest';
import { orderHardestFirst } from '../orderHardestFirst';

interface Row {
  code: string;
  rate: number | null;
  done: boolean;
}

const row = (code: string, rate: number | null, done = false): Row => ({ code, rate, done });
const order = (rows: Row[]) =>
  orderHardestFirst(
    rows,
    (r) => r.rate,
    (r) => r.done
  ).map((r) => r.code);

describe('orderHardestFirst', () => {
  it('ranks the unfinished subjects by fail rate, hardest first', () => {
    expect(order([row('a', 9), row('b', 28), row('c', 11)])).toEqual(['b', 'c', 'a']);
  });

  it('puts a subject with no rate below one measured at 0 %', () => {
    // An absence of data is not data. `computeFailRate` returns null under ten
    // results, and calling that the easiest subject on the screen would be a
    // claim IS never made.
    expect(order([row('unknown', null), row('measured', 0)])).toEqual(['measured', 'unknown']);
  });

  it('keeps the finished subjects last, in the order they arrived', () => {
    expect(
      order([row('doneEasy', 2, true), row('hard', 28), row('doneHard', 30, true), row('easy', 3)])
    ).toEqual(['hard', 'easy', 'doneEasy', 'doneHard']);
  });

  it('leaves ties in the order they came in', () => {
    expect(order([row('first', 11), row('second', 11)])).toEqual(['first', 'second']);
  });

  it('falls back to the given order when nothing has a rate', () => {
    expect(order([row('a', null), row('b', null)])).toEqual(['a', 'b']);
  });

  it('does not mutate what it was given', () => {
    const rows = [row('a', 9), row('b', 28)];
    orderHardestFirst(
      rows,
      (r) => r.rate,
      (r) => r.done
    );
    expect(rows.map((r) => r.code)).toEqual(['a', 'b']);
  });
});
