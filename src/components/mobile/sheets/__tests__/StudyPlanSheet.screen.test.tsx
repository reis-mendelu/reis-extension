import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudyPlanSheet } from '../StudyPlanSheet';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The study plan is a page, not a slidedown.
 *
 * "Studijni plan shouldn't be a slidedown but rather it's own page when I click
 * on it." It was a `full` bottom sheet: it slid up over the tab, sat under a
 * drag pill, dimmed the screen behind it, and could be thrown away downward.
 *
 * That vocabulary is wrong for it. A bottom sheet says "this is temporary, and
 * what is underneath still matters" — right for a subject's detail or a
 * confirmation, wrong for a whole curriculum you navigate INTO and then walk
 * back out of. `Sheet variant="screen"` is the shape the app already has for
 * that, and `SubjectDrawerSheet` — pushed FROM this page — has used it all
 * along, so going deeper used to mean going from a sheet to a page and back to
 * a sheet.
 *
 * It stays in the sheet STACK, which is what keeps back working and what lets
 * it push the subject drawer on top. Only the presentation changes.
 */
describe('StudyPlanSheet is presented as a screen', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      studyPlanDual: null,
      successRates: {},
    } as never);
  });

  it('has no backdrop, because there is nothing behind it to return to by tapping', () => {
    render(<StudyPlanSheet onClose={() => {}} />);
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument();
  });

  // The slide-in is GONE, and its absence is asserted so it cannot creep back.
  //
  // On the iPad it played, reversed part-way, and played again — reported as
  // "it slides in but then a bit back and then again in weirdly". It could not
  // be reproduced anywhere instrumentable: traced in a real browser, the panel
  // showed one node, one `screenIn`, and a monotonic 834→0px over 260ms, and
  // Dominik confirmed localhost is reliable. So the fault lives in the WebView,
  // where the screen can be photographed but not driven.
  //
  // The animation was decoration — it existed to make the push read as forward
  // navigation, nothing more. When the only purpose of a piece of code is
  // polish and the polish misfires on the device it was built for, removing it
  // is not hiding the bug: it removes the thing that IS the bug. The page still
  // covers the viewport and back still returns; only the ceremony is gone.
  it('covers the viewport, and arrives without an entrance animation', () => {
    render(<StudyPlanSheet onClose={() => {}} />);
    const panel = screen.getByTestId('sheet-panel');
    expect(panel.className).toContain('inset-0');
    expect(panel.className).not.toContain('animate-[screenIn');
    // Sliding UP is the bottom-sheet vocabulary this is deliberately leaving.
    expect(panel.className).not.toContain('animate-[sheetUp');
  });

  it('advertises no drag handle, and cannot be thrown away downward', () => {
    const onClose = vi.fn();
    render(<StudyPlanSheet onClose={onClose} />);
    const panel = screen.getByTestId('sheet-panel');
    // The pill promised a gesture; a screen is left by going back. Leaving it
    // there while disabling the drag is the worse of the two options.
    expect(panel.querySelector('.w-9.rounded-full')).toBeNull();
    fireEvent.pointerDown(panel, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(panel, { clientY: 500, pointerId: 1 });
    expect(onClose).not.toHaveBeenCalled();
    expect(panel.style.transform).toBe('');
  });

  it("is still left by the page's own back arrow", () => {
    const onClose = vi.fn();
    render(<StudyPlanSheet onClose={onClose} />);
    // StudyPlanPage renders its own header; this is the route out.
    const back = screen.getAllByRole('button')[0];
    fireEvent.click(back as HTMLElement);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
