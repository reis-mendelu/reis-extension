import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import cs from '../../../i18n/locales/cs.json';
import { useAppStore } from '../../../store/useAppStore';

const trackFeatureSignal = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../../api/featureUsage', () => ({ trackFeatureSignal }));

import { SupportPrompt, SEEN_DWELL_MS } from '../SupportPrompt';

/** The prompt scrolled into view by hand; happy-dom has no layout to do it. */
class FakeObserver {
  static all: FakeObserver[] = [];
  targets = new Set<Element>();
  cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    FakeObserver.all.push(this);
  }
  observe = (el: Element) => void this.targets.add(el);
  unobserve = (el: Element) => void this.targets.delete(el);
  disconnect = () => this.targets.clear();
  static report(isIntersecting: boolean, intersectionRatio = isIntersecting ? 1 : 0) {
    for (const o of FakeObserver.all) {
      for (const el of o.targets) {
        const entry = {
          target: el,
          isIntersecting,
          intersectionRatio,
        } as IntersectionObserverEntry;
        o.cb([entry], o as unknown as IntersectionObserver);
      }
    }
  }
}

const support = cs.support;

const onAnswer = vi.fn();
const onShown = vi.fn();
function renderPrompt(answered = false) {
  return render(<SupportPrompt answered={answered} onAnswer={onAnswer} onShown={onShown} />);
}

/**
 * The willingness-to-pay test (2026-10-16): a question with a price and one
 * answer, counted as two install-level signals — seen and yes — so the result
 * is a share of the students who actually had the question in front of them.
 */
describe('SupportPrompt', () => {
  beforeEach(() => {
    FakeObserver.all = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    useAppStore.setState({ language: 'cz' });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('asks the question with the price and says nothing will be charged', () => {
    renderPrompt();

    expect(screen.getByText(support.question)).toBeTruthy();
    // The price keeps "99 Kč" together with a no-break space, which the
    // default text matcher normalises to a plain one.
    expect(screen.getByText(support.note.replace(/\s+/g, ' '))).toBeTruthy();
    expect(screen.getByRole('button', { name: support.yes })).toBeTruthy();
  });

  it('counts "seen" only after the question has stayed on screen', () => {
    vi.useFakeTimers();
    try {
      renderPrompt();
      FakeObserver.report(false);
      vi.advanceTimersByTime(SEEN_DWELL_MS * 2);
      expect(trackFeatureSignal).not.toHaveBeenCalled();

      FakeObserver.report(true);
      vi.advanceTimersByTime(SEEN_DWELL_MS - 1);
      expect(trackFeatureSignal).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(trackFeatureSignal).toHaveBeenCalledExactlyOnceWith('support_prompt_seen');
    } finally {
      vi.useRealTimers();
    }
  });

  // Novinky opened and closed again at once is not a student who read the
  // question.
  it('does not count a glance that leaves before the threshold', () => {
    vi.useFakeTimers();
    try {
      renderPrompt();
      FakeObserver.report(true);
      vi.advanceTimersByTime(SEEN_DWELL_MS - 100);
      FakeObserver.report(false);
      vi.advanceTimersByTime(SEEN_DWELL_MS * 2);
      expect(trackFeatureSignal).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not count a mostly clipped question as seen', () => {
    vi.useFakeTimers();
    try {
      renderPrompt();
      FakeObserver.report(true, 0.2);
      vi.advanceTimersByTime(SEEN_DWELL_MS * 2);
      expect(trackFeatureSignal).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not count time while the page is in the background', () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    try {
      renderPrompt();
      FakeObserver.report(true);
      vi.advanceTimersByTime(SEEN_DWELL_MS - 100);
      visibility.mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(SEEN_DWELL_MS * 2);
      expect(trackFeatureSignal).not.toHaveBeenCalled();

      visibility.mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(SEEN_DWELL_MS);
      expect(trackFeatureSignal).toHaveBeenCalledExactlyOnceWith('support_prompt_seen');
    } finally {
      visibility.mockRestore();
      vi.useRealTimers();
    }
  });

  // A "yes" outside the denominator would push the share past what it means.
  it('counts an answer as seen even when the student leaves at once', () => {
    const { unmount } = renderPrompt();
    fireEvent.click(screen.getByRole('button', { name: support.yes }));
    unmount();

    expect(trackFeatureSignal).toHaveBeenCalledWith('support_prompt_seen');
    expect(trackFeatureSignal).toHaveBeenCalledWith('support_prompt_yes');
  });

  it('answers "yes" on the tap', () => {
    renderPrompt();

    fireEvent.click(screen.getByRole('button', { name: support.yes }));

    expect(trackFeatureSignal).toHaveBeenCalledWith('support_prompt_yes');
    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('yes');
  });

  it('thanks without claiming a payment once answered', () => {
    renderPrompt(true);

    expect(screen.getByText(support.thanks)).toBeTruthy();
    expect(screen.getByText(support.thanksNote)).toBeTruthy();
    // Answered: nothing left to tap.
    expect(screen.queryByRole('button')).toBeNull();
  });

  // "Ne" is kept on the device: a counter for it would be a new feature label,
  // which needs a migration and a disclosure. The share is yes / seen.
  it('takes a "no" without sending anything', () => {
    renderPrompt();

    fireEvent.click(screen.getByRole('button', { name: support.no }));

    expect(onAnswer).toHaveBeenCalledExactlyOnceWith('dismissed');
    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });

  // Being on screen in Novinky is what clears the bell's badge for it.
  it('reports that it is showing', () => {
    renderPrompt();
    expect(onShown).toHaveBeenCalled();
  });
});
