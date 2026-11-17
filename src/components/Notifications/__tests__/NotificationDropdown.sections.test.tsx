import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { NotificationDropdown } from '../NotificationDropdown';
import { useAppStore } from '../../../store/useAppStore';
import type { DeadlineAlert } from '../../../hooks/useDeadlineAlerts';

const POINTS: DeadlineAlert = {
  id: 'zaznamnik-EBC-PS-a=9',
  type: 'zaznamnik-points',
  title: 'Počítačové sítě',
  body: 'Test 1: 9',
  courseCode: 'EBC-PS',
};

const MY_EXAM: DeadlineAlert = {
  id: 'exam-mine-1',
  type: 'exam-registered',
  title: 'Vývoj webových aplikací',
  body: 'Obhajoba práce · Q05 (ČP)',
  deadline: new Date(2026, 11, 7, 11, 0),
  hoursUntil: 40,
};

/**
 * The extension's bell groups its rows exactly as the phone's Novinky sheet
 * does: news from the záznamník, then what is coming. One unlabelled stack was
 * the jumble the phone already fixed.
 */
describe('extension bell: sections', () => {
  beforeEach(() =>
    useAppStore.setState({ language: 'cz', now: new Date(2026, 11, 6, 9, 0) } as never)
  );

  it('labels the záznamník news and the coming dates apart', () => {
    render(
      <NotificationDropdown
        dropdownRef={createRef()}
        notifications={[]}
        loading={false}
        onClose={vi.fn()}
        onVisible={vi.fn()}
        onShowMap={vi.fn()}
        deadlineAlerts={[POINTS, MY_EXAM]}
      />
    );
    expect(screen.getByText('Záznamník')).toBeInTheDocument();
    expect(screen.getByText('Blížící se termíny')).toBeInTheDocument();
    // Their own exam: section and room, and when — "Zítra", not a countdown.
    expect(screen.getByText(/Obhajoba práce · Q05 \(ČP\)/)).toBeInTheDocument();
    expect(screen.getByText('Zítra 11:00')).toBeInTheDocument();
  });
});
