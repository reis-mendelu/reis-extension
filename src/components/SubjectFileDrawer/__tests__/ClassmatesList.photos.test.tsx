import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ClassmatesList } from '../ClassmatesList';
import { __resetResolvedPhotos } from '../../../hooks/data/usePersonPhoto';

const fetchPersonPhoto = vi.hoisted(() => vi.fn());
vi.mock('../../../api/personPhoto', () => ({ fetchPersonPhoto }));

/** Rows the test scrolls into view by hand; jsdom has no layout to do it. */
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
  static show(el: Element) {
    for (const o of FakeObserver.all) {
      if (!o.targets.has(el)) continue;
      const entry = { target: el, isIntersecting: true } as IntersectionObserverEntry;
      o.cb([entry], o as unknown as IntersectionObserver);
    }
  }
}

const person = (i: number) => ({
  personId: 900000 + i,
  photoUrl: '',
  name: `Student ${String(i).padStart(3, '0')}`,
  studyInfo: '',
});
const LECTURE = Array.from({ length: 519 }, (_, i) => person(i));
const row = (name: string) => screen.getByText(name).closest('[role="button"]')!;

/**
 * Every row's photo is its own request to IS (through the content script, or
 * CapacitorHttp on the app). The whole list is rendered now, so a 519-student
 * lecture must still ask only for the faces near the screen.
 */
describe('ClassmatesList — photos load only for rows on screen', () => {
  beforeEach(() => {
    FakeObserver.all = [];
    __resetResolvedPhotos();
    fetchPersonPhoto.mockReset().mockResolvedValue('data:image/jpeg;base64,AA==');
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('requests no photo for a row that has not come near the screen', () => {
    render(<ClassmatesList classmates={LECTURE} showStudyInfo={false} onOpen={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(519);
    expect(fetchPersonPhoto).not.toHaveBeenCalled();
  });

  it('watches all 519 rows through one observer, not one each', () => {
    const { unmount } = render(
      <ClassmatesList classmates={LECTURE} showStudyInfo={false} onOpen={() => {}} />
    );
    expect(FakeObserver.all).toHaveLength(1);
    expect(FakeObserver.all[0]!.targets.size).toBe(519);
    unmount();
    expect(FakeObserver.all[0]!.targets.size).toBe(0);
  });

  it('requests exactly the rows that came into view', async () => {
    render(<ClassmatesList classmates={LECTURE} showStudyInfo={false} onOpen={() => {}} />);
    await act(async () => {
      FakeObserver.show(row('Student 000'));
      FakeObserver.show(row('Student 001'));
    });
    expect(fetchPersonPhoto.mock.calls.map(([id]) => String(id))).toEqual(['900000', '900001']);
    expect(row('Student 000').querySelector('img')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,AA=='
    );
  });

  // The name is printed beside the photo inside the same button, so an alt
  // naming the person made a screen reader say it twice.
  it('names the row once — the photo beside the name is decorative', async () => {
    render(<ClassmatesList classmates={LECTURE} showStudyInfo={false} onOpen={() => {}} />);
    await act(async () => {
      FakeObserver.show(row('Student 000'));
    });
    expect(row('Student 000').querySelector('img')).toHaveAttribute('alt', '');
    expect(row('Student 000')).toHaveAccessibleName('Student 000');
  });

  it('loads every photo where IntersectionObserver does not exist', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(
      <ClassmatesList classmates={LECTURE.slice(0, 3)} showStudyInfo={false} onOpen={() => {}} />
    );
    expect(fetchPersonPhoto).toHaveBeenCalledTimes(3);
  });
});
