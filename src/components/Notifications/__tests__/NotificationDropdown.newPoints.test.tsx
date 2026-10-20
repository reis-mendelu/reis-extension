import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createRef } from 'react';
import { NotificationDropdown } from '../NotificationDropdown';
import { useAppStore } from '../../../store/useAppStore';
import type { DeadlineAlert } from '../../../hooks/useDeadlineAlerts';

const POINTS: DeadlineAlert = {
  id: 'zaznamnik-EBC-PS-a=9',
  type: 'zaznamnik-points',
  title: 'Počítačové sítě',
  body: 'IPv4-subnt-NAOPAK: 9',
  courseCode: 'EBC-PS',
  courseId: '164074',
};

describe('extension bell: new záznamník points', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));

  it('the row closes the dropdown and opens the subject', () => {
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
        deadlineAlerts={[POINTS]}
        onOpenSubject={onOpenSubject}
      />
    );
    expect(screen.getByText('Nové body')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Počítačové sítě/ }));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenSubject).toHaveBeenCalledWith(POINTS);
  });
});
