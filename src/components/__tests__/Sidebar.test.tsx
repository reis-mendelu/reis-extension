import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  it('clicking the logo goes to calendar', () => {
    const onViewChange = vi.fn();
    render(
      <Sidebar
        currentView="exams"
        onViewChange={onViewChange}
        items={[{ id: 'dashboard', label: 'Přehled', icon: <span /> }]}
      />
    );
    const logoButton = screen.getAllByRole('button')[0]!;
    fireEvent.click(logoButton);
    expect(onViewChange).toHaveBeenCalledWith('calendar');
  });
});
