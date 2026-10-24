import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QuestionRow } from '../QuestionRow';
import type { Question } from '../../../types/questions';

const openExternal = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../../mobile/openExternal', () => ({ openExternal }));
const shareLink = vi.hoisted(() => vi.fn(async (): Promise<string> => 'copied'));
vi.mock('../../../mobile/shareLink', () => ({ shareLink }));

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
  buttons: ['1', '2', '3', '4', '5'].map((k) => ({
    key: k,
    cz: k,
    en: k,
    ...(k === '1' && { hintCz: 'nejhorší', hintEn: 'worst' }),
    ...(k === '5' && { hintCz: 'nejlepší', hintEn: 'best' }),
  })),
};
const link: Question = {
  ...base,
  id: 'q3',
  buttons: [{ key: 'open', cz: 'Otevřít reByt', en: 'Open reByt', url: 'https://rebyt.example' }],
};

const share: Question = {
  ...base,
  id: 'q4',
  icon: 'google_play',
  buttons: [
    {
      key: 'share',
      cz: 'Sdílet odkaz',
      en: 'Share link',
      url: 'https://play.google.com/store/apps/details?id=cz.reis.app',
      share: true,
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('QuestionRow', () => {
  it('asks in the student’s language and answers with the tapped key', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionRow question={base} language="en" answeredKey={undefined} onAnswer={onAnswer} />
    );
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
    render(
      <QuestionRow question={scale} language="cz" answeredKey={undefined} onAnswer={vi.fn()} />
    );
    for (const k of ['1', '2', '3', '4', '5'])
      expect(screen.getByRole('button', { name: k })).toBeTruthy();
  });

  // Tonda, 2026-10-22: the first banner said only "(1-5)", and nobody knew
  // which end was good. The ends are labelled on the scale itself.
  it('labels both ends of a scale in the student’s language', () => {
    render(
      <QuestionRow question={scale} language="en" answeredKey={undefined} onAnswer={vi.fn()} />
    );
    expect(screen.getByText('worst')).toBeTruthy();
    expect(screen.getByText('best')).toBeTruthy();
  });

  it('counts and opens a link, and keeps the row', () => {
    const onAnswer = vi.fn();
    render(
      <QuestionRow question={link} language="cz" answeredKey={undefined} onAnswer={onAnswer} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Otevřít reByt/ }));
    expect(onAnswer).toHaveBeenCalledWith('open');
    expect(openExternal).toHaveBeenCalledWith('https://rebyt.example');
    expect(screen.getByRole('button', { name: /Otevřít reByt/ })).toBeTruthy();
  });

  // 5.5.0: reIS on Google Play. The point is that a student passes the link on,
  // so the button shares it rather than opening the store.
  it('shares a share link instead of opening it, and keeps the row', async () => {
    const onAnswer = vi.fn();
    render(
      <QuestionRow question={share} language="cz" answeredKey={undefined} onAnswer={onAnswer} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Sdílet odkaz/ }));
    expect(onAnswer).toHaveBeenCalledWith('share');
    expect(shareLink).toHaveBeenCalledWith(share.buttons[0].url);
    expect(openExternal).not.toHaveBeenCalled();
    expect((await screen.findByRole('status')).textContent).toContain('Odkaz zkopírován');
    expect(screen.getByRole('button', { name: /Sdílet odkaz/ })).toBeTruthy();
  });

  it('says nothing was copied when the clipboard refused', async () => {
    shareLink.mockResolvedValueOnce('failed');
    render(
      <QuestionRow question={share} language="cz" answeredKey={undefined} onAnswer={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /Sdílet odkaz/ }));
    await Promise.resolve();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('draws the Google Play arrow for a google_play question, the question mark otherwise', () => {
    render(
      <QuestionRow question={share} language="cz" answeredKey={undefined} onAnswer={vi.fn()} />
    );
    expect(screen.getByTestId('google-play-icon')).toBeTruthy();
    cleanup();
    render(
      <QuestionRow question={base} language="cz" answeredKey={undefined} onAnswer={vi.fn()} />
    );
    expect(screen.queryByTestId('google-play-icon')).toBeNull();
  });
});
