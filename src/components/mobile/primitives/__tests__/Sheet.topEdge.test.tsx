import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sheet } from '../Sheet';

/**
 * Sheets stack: a classmate tapped inside the subject drawer pushes a PersonSheet
 * over a sheet that is already open. Both panels are `bg-base-100`, and
 * `--shadow-drawer` casts DOWNWARD (`0 20px 25px -5px`), so it contributes
 * nothing at a bottom sheet's top edge — the two surfaces met with no visible
 * seam and read as one continuous background. A hairline on the rounded top
 * edge is what separates them, the same one FeedbackModal's phone branch uses.
 */
describe('Sheet top edge', () => {
  it('draws a hairline along the top edge of a bottom sheet', () => {
    render(
      <Sheet size="content" onClose={() => {}}>
        x
      </Sheet>
    );
    const panel = screen.getByTestId('sheet-panel');
    expect(panel.className).toContain('border-t');
    expect(panel.className).toContain('border-base-content/15');
  });

  // A screen is full-bleed against the viewport edge: a line there is not a
  // seam between two surfaces, just a stripe under the status bar.
  it('draws none on a pushed screen', () => {
    render(
      <Sheet size="full" variant="screen" onClose={() => {}}>
        x
      </Sheet>
    );
    expect(screen.getByTestId('sheet-panel').className).not.toContain('border-t');
  });
});
