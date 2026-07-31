import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../Sheet';

describe('Sheet', () => {
  it('renders its children', () => {
    render(
      <Sheet size="content" onClose={() => {}}>
        hello
      </Sheet>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="content" onClose={onClose}>
        body
      </Sheet>
    );
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when the panel itself is clicked', () => {
    const onClose = vi.fn();
    render(
      <Sheet size="content" onClose={onClose}>
        body
      </Sheet>
    );
    fireEvent.click(screen.getByTestId('sheet-panel'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('full size pins the panel below the status area; content size hugs the bottom', () => {
    const { rerender } = render(
      <Sheet size="full" onClose={() => {}}>
        x
      </Sheet>
    );
    expect(screen.getByTestId('sheet-panel').className).toContain('top-[70px]');
    rerender(
      <Sheet size="content" onClose={() => {}}>
        x
      </Sheet>
    );
    expect(screen.getByTestId('sheet-panel').className).not.toContain('top-[70px]');
  });
});
