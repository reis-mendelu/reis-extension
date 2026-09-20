import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { RouteButton } from '../RouteButton';
import { makeLesson } from '../../../test/fixtures/lesson';

/**
 * A lesson later TODAY, in a building that is not the one the suggestion names.
 * Without it the two candidate targets cannot be told apart, and a button that
 * happened to route correctly by coincidence would pass.
 */
function lessonLaterToday(room: string) {
  const now = new Date();
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const hh = String(Math.min(23, now.getHours() + 1)).padStart(2, '0');
  return makeLesson({ date: d, startTime: `${hh}:00`, endTime: `${hh}:50`, room });
}

describe('RouteButton with a lesson suggestion', () => {
  beforeEach(() => {
    useAppStore.getState().clearRoute();
    useAppStore.setState({ language: 'cz' });
  });

  it('walks to the lesson the student pointed at, not to the next one today', () => {
    const routeTo = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ routeTo, schedule: { data: [lessonLaterToday('B11')] } } as never);
    useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });

    render(<RouteButton />);
    fireEvent.click(screen.getByRole('button'));

    expect(routeTo).toHaveBeenCalledWith('Q');
  });

  it('says which room it is offering, so the button is about that lecture', () => {
    useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    render(<RouteButton />);
    expect(screen.getByRole('button').textContent).toContain('Q31');
  });

  it('falls back to the generic label with no suggestion', () => {
    render(<RouteButton />);
    expect(screen.getByRole('button').textContent).toContain('Najdi cestu');
  });
});
