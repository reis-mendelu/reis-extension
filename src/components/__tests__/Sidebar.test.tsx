import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';
import { mainItems } from '../Menu/MainItems';

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

  it('has a first-class "Starý IS" item that opens the old-IS view', () => {
    const onViewChange = vi.fn();
    const items = mainItems('1', '2', (k) => (k === 'sidebar.isPages' ? 'Starý IS' : k), 'cz');
    render(<Sidebar currentView="calendar" onViewChange={onViewChange} items={items} />);
    fireEvent.click(screen.getByRole('button', { name: /Starý IS/ }));
    expect(onViewChange).toHaveBeenCalledWith('oldIs');
  });

  it('marks the old-IS item active while that view is open', () => {
    const items = mainItems('1', '2', (k) => (k === 'sidebar.isPages' ? 'Starý IS' : k), 'cz');
    render(<Sidebar currentView="oldIs" onViewChange={() => {}} items={items} />);
    expect(screen.getByRole('button', { name: /Starý IS/ }).className).toContain('bg-primary/10');
  });
});
