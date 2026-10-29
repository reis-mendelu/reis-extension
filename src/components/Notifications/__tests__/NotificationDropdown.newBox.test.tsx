import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { NotificationDropdown } from '../NotificationDropdown';
import { useAppStore } from '../../../store/useAppStore';
import type { DeadlineAlert } from '../../../hooks/useDeadlineAlerts';

const NEW_BOX: DeadlineAlert = {
  id: 'odev-new-9001',
  type: 'assignment-new',
  title: 'Matematika',
  body: 'Build MATLAB Proficiency',
  deadline: new Date(2026, 11, 20, 23, 59),
  courseCode: 'EBC-MAT',
  courseId: '164074',
};

describe('extension bell: new odevzdávárna', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));

  it('the row names it, closes the dropdown and opens the subject', () => {
    const onClose = vi.fn();
    const onOpenSubject = vi.fn();
    render(
      <NotificationDropdown
        dropdownRef={createRef()}
        notifications={[]}
        loading={false}
        onClose={onClose}
        onVisible={vi.fn()}
        onShowMap={vi.fn()}
        deadlineAlerts={[NEW_BOX]}
        onOpenSubject={onOpenSubject}
      />
    );
    // "Nová" leads the box's name; the date takes the meta column; the full
    // kind is there for a screen reader.
    expect(screen.getByText('Nová · Build MATLAB Proficiency')).toBeInTheDocument();
    expect(screen.getByText('Nová odevzdávárna:')).toBeInTheDocument();
    expect(screen.getByText(/^do 20\. ?12\.$/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Matematika/ }));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenSubject).toHaveBeenCalledWith(NEW_BOX);
  });
});
