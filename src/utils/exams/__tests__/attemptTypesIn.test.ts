import { describe, it, expect } from 'vitest';
import { attemptTypesIn } from '../attemptTypesIn';
import type { ExamTerm } from '../../../types/exams';

const term = (id: string, attemptTypes?: ExamTerm['attemptTypes']): ExamTerm => ({
  id,
  date: '12.01.2027',
  time: '09:00',
  attemptTypes,
});

describe('attemptTypesIn', () => {
  it('names each type once, in attempt order, whatever order the terms list them', () => {
    const terms = [
      term('1', ['retake2', 'retake1']),
      term('2', ['regular']),
      term('3', ['retake1']),
    ];
    expect(attemptTypesIn(terms)).toEqual(['regular', 'retake1', 'retake2']);
  });

  it('leaves out types no term carries — the legend explains only what is on screen', () => {
    expect(attemptTypesIn([term('1', ['regular']), term('2', ['regular'])])).toEqual(['regular']);
  });

  it('is empty when IS gave no type at all, so no legend renders', () => {
    expect(attemptTypesIn([term('1'), term('2', [])])).toEqual([]);
    expect(attemptTypesIn([])).toEqual([]);
  });
});
