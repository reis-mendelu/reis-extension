import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpolkySection } from '../SpolkySection';

// The manage button must close its surrounding popover (onNavigate) so entering
// society mode is visible — otherwise the click reads as "nothing happened".
describe('SpolkySection manage button', () => {
  it('calls onNavigate (closes the popover) when "Spravovat spolek" is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <SpolkySection
        expanded
        onToggle={() => {}}
        isSub={() => false}
        onToggleAssoc={() => {}}
        onNavigate={onNavigate}
      />
    );
    fireEvent.click(screen.getByText('Spravovat spolek'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
