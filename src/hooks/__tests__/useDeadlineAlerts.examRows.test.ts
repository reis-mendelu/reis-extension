import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDeadlineAlerts } from '../useDeadlineAlerts';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSection, ExamSubject, ExamTerm } from '../../types/exams';

const NOW = new Date(2026, 11, 1, 12, 0); // Tue 1 Dec 2026, 12:00

const term = (id: string, extra: Partial<ExamTerm> = {}): ExamTerm => ({
  id,
  date: '14.12.2026',
  time: '15:00',
  capacity: { occupied: 0, total: 60, raw: '0/60' },
  ...extra,
});

const subject = (section: Partial<ExamSection>, code = 'EBC-MNG'): ExamSubject => ({
  version: 1,
  id: code,
  name: 'Management',
  code,
  sections: [{ id: 's1', name: 'Zápočet', type: 'test', status: 'open', terms: [], ...section }],
});

const setExams = (...subjects: ExamSubject[]) =>
  useAppStore.setState({ exams: { ...useAppStore.getState().exams, data: subjects } });

const alerts = () => renderHook(() => useDeadlineAlerts()).result.current.alerts;
const examRows = () => alerts().filter((a) => a.type.startsWith('exam-'));

/**
 * IS's parser emits `open` (not registered) and `registered`, never
 * `available` — the value these rows used to require, so they never appeared.
 * The shapes here are the ones a real exam list has (2026-11-17).
 */
describe('useDeadlineAlerts – exam rows', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      odevzdavarny: [],
      cvicneTests: [],
      language: 'cz',
      zaznamnikNewPoints: {},
      odevzdavarnyNew: [],
    } as never);
  });

  it('announces registration opening for a section the student is not registered in', () => {
    setExams(subject({ terms: [term('a', { registrationStart: '01.12.2026 18:00' })] }));
    expect(examRows().map((a) => a.type)).toEqual(['exam-reg-opens']);
  });

  it('gives a section one opening row, however many terms open at once', () => {
    const start = { registrationStart: '01.12.2026 18:00' };
    setExams(subject({ terms: [term('a', start), term('b', start), term('c', start)] }));
    expect(examRows()).toHaveLength(1);
  });

  it('announces closing only when the last registrable term closes within a day', () => {
    const open = { registrationStart: '20.11.2026 00:00' };
    setExams(
      subject({ terms: [term('a', { ...open, registrationEnd: '02.12.2026 08:00' })] }),
      subject(
        {
          // A later term still takes registrations: nothing is closing yet.
          terms: [
            term('b', { ...open, registrationEnd: '02.12.2026 08:00' }),
            term('c', { ...open, registrationEnd: '20.12.2026 08:00' }),
          ],
        },
        'EBC-PJ'
      )
    );
    const rows = examRows();
    expect(rows.map((a) => [a.type, a.id])).toEqual([['exam-reg', 'exam-reg-a']]);
  });

  it('ignores full terms when deciding whether registration is closing', () => {
    const open = { registrationStart: '20.11.2026 00:00' };
    setExams(
      subject({
        terms: [
          term('a', { ...open, registrationEnd: '02.12.2026 08:00' }),
          term('b', { ...open, registrationEnd: '20.12.2026 08:00', full: true }),
        ],
      })
    );
    expect(examRows().map((a) => a.type)).toEqual(['exam-reg']);
  });

  // IS can leave a term's end blank: it still takes registrations, so nothing is closing.
  it('says nothing is closing while a term with no known end still takes registrations', () => {
    const open = { registrationStart: '20.11.2026 00:00' };
    setExams(
      subject({
        terms: [term('a', { ...open, registrationEnd: '02.12.2026 08:00' }), term('b', open)],
      })
    );
    expect(examRows()).toEqual([]);
  });

  // A term that opens later is still a chance to register: nothing is closing yet.
  it('says nothing is closing while a later term has yet to open', () => {
    setExams(
      subject({
        terms: [
          term('a', { registrationStart: '20.11.2026 00:00', registrationEnd: '01.12.2026 18:00' }),
          term('b', { registrationStart: '02.12.2026 06:00', registrationEnd: '09.12.2026 08:00' }),
        ],
      })
    );
    expect(examRows().filter((a) => a.type === 'exam-reg')).toEqual([]);
  });

  // IS can leave the time blank; a row with an invalid date says nothing useful.
  it('leaves out an own exam whose time IS left blank', () => {
    setExams(
      subject({ status: 'registered', registeredTerm: { id: 'r', date: '03.12.2026', time: '' } })
    );
    expect(examRows()).toEqual([]);
  });

  it('says nothing about registration in a section the student is registered in', () => {
    setExams(
      subject({
        status: 'registered',
        registeredTerm: { id: 'r', date: '20.12.2026', time: '11:00' },
        terms: [term('a', { registrationStart: '01.12.2026 18:00' })],
      })
    );
    expect(examRows().filter((a) => a.type !== 'exam-registered')).toEqual([]);
  });

  it("lists the student's own exam in the coming week, with its room", () => {
    setExams(
      subject({
        status: 'registered',
        registeredTerm: { id: 'r', date: '07.12.2026', time: '11:00', roomCs: 'Q05 (ČP)' },
      })
    );
    const [row] = examRows();
    expect(row).toMatchObject({ type: 'exam-registered', id: 'exam-mine-r', title: 'Management' });
    expect(row?.body).toContain('Q05 (ČP)');
    expect(row?.deadline).toEqual(new Date(2026, 11, 7, 11, 0));
  });

  it('leaves out an exam more than a week away, and one already over', () => {
    const mine = (date: string) =>
      subject({ status: 'registered', registeredTerm: { id: date, date, time: '11:00' } });
    setExams(mine('10.12.2026'), mine('30.11.2026'));
    expect(examRows()).toEqual([]);
  });

  it('never lists practice tests: they live in the subject', () => {
    useAppStore.setState({
      cvicneTests: [
        {
          courseId: '1',
          courseNameCs: 'Odborná terminologie',
          courseNameEn: 'Terminology',
          name: 'Textbook',
          status: 'accessible',
          url: 'https://is.mendelu.cz/x',
        },
      ],
    } as never);
    expect(alerts()).toEqual([]);
  });
});
