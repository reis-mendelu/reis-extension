import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuestionRow } from '../QuestionRow';
import type { Question } from '../../../types/questions';

const openExternal = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../../mobile/openExternal', () => ({ openExternal }));

const base: Question = {
  id: 'q1',
  promptCz: 'Chceš tmavý režim?',
  promptEn: 'Do you want dark mode?',
  noteCz: 'Jen se ptáme.',
  noteEn: 'Just asking.',
  buttons: [
    { key: 'yes', cz: 'Ano', en: 'Yes' },
    { key: 'no', cz: 'Ne', en: 'No' },
  ],
  startsAt: '2026-10-25T08:00:00Z',
  endsAt: '2026-11-25T08:00:00Z',
  faculties: null,
};
const scale: Question = {
  ...base,
  id: 'q2',
  buttons: ['1', '2', '3', '4', '5'].map((k) => ({ key: k, cz: k, en: k })),
};
const link: Question = {
  ...base,
  id: 'q3',
  buttons: [{ key: 'open', cz: 'Otevřít reByt', en: 'Open reByt', url: 'https://rebyt.example' }],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('QuestionRow', () => {
  it('asks in the student’s language and answers with the tapped key', () => {
    const onAnswer = vi.fn();
    render(<QuestionRow question={base} language="en" answeredKey={undefined} onAnswer={onAnswer} />);
    expect(screen.getByText('Do you want dark mode?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onAnswer).toHaveBeenCalledWith('no');
  });

  // Decided 2026-10-22: an answered question stays, as "Díky", until it ends.
  it('thanks instead of asking once answered, and shows what was chosen', () => {
    render(<QuestionRow question={base} language="cz" answeredKey="yes" onAnswer={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Ano' })).toBeNull();
    expect(screen.getByRole('status').textContent).toContain('Ano');
  });

  it('renders a 1–5 scale as five buttons', () => {
    render(<QuestionRow question={scale} language="cz" answeredKey={undefined} onAnswer={vi.fn()} />);
    for (const k of ['1', '2', '3', '4', '5']) expect(screen.getByRole('button', { name: k })).toBeTruthy();
  });

  it('counts and opens a link, and keeps the row', () => {
    const onAnswer = vi.fn();
    render(<QuestionRow question={link} language="cz" answeredKey={undefined} onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: /Otevřít reByt/ }));
    expect(onAnswer).toHaveBeenCalledWith('open');
    expect(openExternal).toHaveBeenCalledWith('https://rebyt.example');
    expect(screen.getByRole('button', { name: /Otevřít reByt/ })).toBeTruthy();
  });
});
