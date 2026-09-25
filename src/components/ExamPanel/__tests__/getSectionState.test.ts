import { describe, it, expect } from 'vitest';
import { getSectionState } from '../utils';
import type { ExamSection } from '../../../types/exams';

const NOW = new Date(2026, 8, 22, 12, 0);

const section = (terms: ExamSection['terms']): ExamSection => ({
  id: 's',
  name: 'Průběžný test 1',
  type: 'test',
  status: 'open',
  terms,
});

/**
 * A term from "Kam se přihlásit nemohu?" carries IS's registration dates like
 * any other, but they will never open for this student. Counting its start as
 * "opens on 9. 11." put a section nobody could join under "Ještě neotevřené".
 */
describe('getSectionState — terms the student cannot sign up for', () => {
  it('does not report a section of blocked terms as opening later', () => {
    const s = section([
      {
        id: '1',
        date: '14.12.2026',
        time: '11:00',
        registrationStart: '09.11.2026 15:00',
        canRegisterNow: false,
        cannotRegister: true,
      },
    ]);
    expect(getSectionState(s, NOW).type).toBe('empty');
  });

  it('still reports the opening of the terms it can join', () => {
    const s = section([
      {
        id: '1',
        date: '14.12.2026',
        time: '11:00',
        registrationStart: '01.11.2026 15:00',
        canRegisterNow: false,
        cannotRegister: true,
      },
      {
        id: '2',
        date: '21.12.2026',
        time: '11:00',
        registrationStart: '14.12.2026 13:00',
        canRegisterNow: false,
      },
    ]);
    const state = getSectionState(s, NOW);
    expect(state.type).toBe('opening');
    expect(state.type === 'opening' && state.earliest.getDate()).toBe(14);
  });
});
