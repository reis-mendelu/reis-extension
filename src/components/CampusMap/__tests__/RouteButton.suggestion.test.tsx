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
    // `clearRoute` keeps the offer now — the × puts the line away, it does
    // not forget the lecture — so a test that wants a clean slate says so.
    useAppStore.getState().suggestRoute(null);
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

  it('can give way on a 320px screen instead of pushing itself off it', () => {
    // Measured, not guessed: at 320 the peek row is the hint (141px, which
    // would not shrink) + this button (178px with a room in it) + a gap + 40px
    // of padding = 367, and the button's right edge landed 26px past the
    // viewport. `flex-shrink-0` was what made a longer label impossible to
    // absorb; the truncating span inside it only helps once the box may shrink.
    useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    render(<RouteButton />);
    // `shrink` as well as `min-w-0`: DaisyUI's own `.btn` rule sets
    // `flex-shrink: 0`, so merely dropping the utility left the computed value
    // at 0 and a long room name still hung 71px off a 320px screen.
    const cls = screen.getByRole('button').className;
    expect(cls).toContain('min-w-0');
    expect(cls).toContain('shrink');
    expect(cls).not.toContain('flex-shrink-0');
  });
});
