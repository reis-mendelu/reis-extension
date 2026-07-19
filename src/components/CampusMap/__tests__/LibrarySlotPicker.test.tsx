import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibrarySlotPicker } from '../LibrarySlotPicker';
import { useAppStore } from '@/store/useAppStore';

// The picker reads strings through useTranslation (store-backed). Pin the
// language so the hour labels ("Any time") are stable.
beforeEach(() => useAppStore.setState({ language: 'en' }));

const baseProps = {
  days: [new Date(2026, 7, 3), new Date(2026, 7, 4), new Date(2026, 7, 5)],
  dayIdx: 1,
  hours: [8, 9, 10],
  hour: null as number | null,
  loc: 'en-US',
};

// The day field is the MiniCalendar trigger — its label carries the year.
const openCalendar = () => fireEvent.click(screen.getByText(/2026/).closest('button')!);

describe('LibrarySlotPicker', () => {
  it('opens a calendar and picks a bookable day → onDay with its index', () => {
    const onDay = vi.fn();
    render(<LibrarySlotPicker {...baseProps} onDay={onDay} onHour={() => {}} />);
    openCalendar();
    fireEvent.click(screen.getByRole('button', { name: '3' })); // Aug 3 = index 0
    expect(onDay).toHaveBeenCalledWith(0);
  });

  it('greys out and blocks days that are not on offer', () => {
    const onDay = vi.fn();
    render(<LibrarySlotPicker {...baseProps} onDay={onDay} onHour={() => {}} />);
    openCalendar();
    const closed = screen.getByRole('button', { name: '10' }); // not in `days`
    expect(closed).toBeDisabled();
    fireEvent.click(closed);
    expect(onDay).not.toHaveBeenCalled();
  });

  it('renders an Any-time toggle plus one pill per open hour', () => {
    render(<LibrarySlotPicker {...baseProps} onDay={() => {}} onHour={() => {}} />);
    expect(screen.getByRole('button', { name: 'Any time' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    for (const h of baseProps.hours) {
      expect(screen.getByRole('button', { name: `${h}:00` })).toBeInTheDocument();
    }
  });

  it('calls onHour with the picked hour, and null for Any time', () => {
    const onHour = vi.fn();
    render(<LibrarySlotPicker {...baseProps} hour={9} onDay={() => {}} onHour={onHour} />);
    fireEvent.click(screen.getByRole('button', { name: '10:00' }));
    expect(onHour).toHaveBeenCalledWith(10);
    fireEvent.click(screen.getByRole('button', { name: 'Any time' }));
    expect(onHour).toHaveBeenCalledWith(null);
  });
});
