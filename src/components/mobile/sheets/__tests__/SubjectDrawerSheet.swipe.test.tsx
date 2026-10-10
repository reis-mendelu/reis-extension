import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubjectDrawerSheet } from '../SubjectDrawerSheet';
import { useAppStore } from '../../../../store/useAppStore';

vi.mock('../../../SubjectFileDrawer/PdfViewer', () => ({ PdfViewer: () => null }));

/**
 * Swiping the subject sheet's body sideways moves to the neighbouring tab.
 *
 * The five tabs sit in a row at the top of a tall sheet, so on a phone held in
 * one hand every tab change was a reach to the top of the screen. The body is
 * where the thumb already is.
 *
 * Phone and iPad only — see src/test/guards/subjectTabSwipeIsPhoneOnly.test.ts.
 */
describe('SubjectDrawerSheet — swiping between tabs', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      subjects: { version: 1, lastUpdated: '', data: {} },
      schedule: { data: [], status: 'success' },
      files: { ALG: [] },
      lastFilesFetchedAt: { ALG: Date.now() },
    } as never);
  });

  const enroll = () =>
    useAppStore.setState({
      subjects: {
        version: 1,
        lastUpdated: '',
        data: {
          ALG: {
            displayName: 'ALG',
            fullName: 'Algoritmizace',
            subjectCode: 'ALG',
            subjectId: '159410',
            folderUrl: 'https://is.mendelu.cz/x',
            fetchedAt: new Date().toISOString(),
          },
        },
      },
    } as never);

  const open = () => {
    render(
      <SubjectDrawerSheet
        sheet={{ kind: 'subjectDrawer', courseCode: 'ALG', courseName: 'Algoritmizace' }}
        onClose={vi.fn()}
      />
    );
    return screen.getByTestId('subject-drawer-scroller');
  };

  const activeTab = () =>
    screen.getAllByRole('button').find((b) => b.classList.contains('border-primary'))?.textContent;

  const swipe = (el: HTMLElement, dx: number, dy = 0) => {
    fireEvent.pointerDown(el, { clientX: 200, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 200 + dx / 2, clientY: 300 + dy / 2, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 200 + dx, clientY: 300 + dy, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 200 + dx, clientY: 300 + dy, pointerId: 1 });
  };

  it('a leftward swipe opens the next tab, a rightward one the previous', () => {
    enroll();
    const body = open();
    expect(activeTab()).toContain('Soubory');
    swipe(body, -120);
    expect(activeTab()).toContain('Spolužáci');
    swipe(body, 120);
    expect(activeTab()).toContain('Soubory');
  });

  it('one tab per swipe, however far the finger travels', () => {
    enroll();
    const body = open();
    swipe(body, -600);
    expect(activeTab()).toContain('Spolužáci');
  });

  it('leaves a vertical drag to the list', () => {
    enroll();
    const body = open();
    swipe(body, 0, 200);
    expect(activeTab()).toContain('Soubory');
  });

  it('stays on the first tab when swiped past it', () => {
    enroll();
    const body = open();
    swipe(body, 120);
    expect(activeTab()).toContain('Soubory');
  });

  it('skips the tabs a subject without a subjectId cannot open', () => {
    // Not enrolled: only Úspěšnost and Sylabus are live, and it opens on the
    // former. Back from there lands nowhere, not on a disabled Spolužáci.
    const body = open();
    expect(activeTab()).toContain('Úspěšnost');
    swipe(body, 120);
    expect(activeTab()).toContain('Úspěšnost');
    swipe(body, -120);
    expect(activeTab()).toContain('Sylabus');
    swipe(body, -120);
    expect(activeTab()).toContain('Sylabus');
  });

  it('keeps the body pannable vertically, not claimed outright', () => {
    // touch-pan-y, as on the calendar day: without it the WebView decides
    // mid-swipe that the gesture is a pan and cancels it.
    expect(open()).toHaveClass('touch-pan-y');
  });

  it("gives the tabs' own vertical scrollers pan-y too", () => {
    // Every tab but Soubory scrolls in its own `overflow-y-auto` box, and a
    // touch resolves touch-action only up to the nearest scroll container — so
    // the outer pan-y did not reach a finger on Spolužáci or Úspěšnost, and the
    // browser cancelled 6 of 120 driven swipes mid-gesture. Pinned by class
    // because happy-dom has no touch-action to measure.
    enroll();
    const body = open();
    expect(body.className).toContain('[&_.overflow-y-auto]:touch-pan-y');
    swipe(body, -120);
    expect(body.querySelector('.overflow-y-auto')).not.toBeNull();
  });
});
