import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';
import type { StudyPlan } from '../../../../types/studyPlan';

const LONG_NAME = 'Marie Anna Nováková-Svobodová';
const PROGRAMME = 'Ekonomická informatika · PEF';

/**
 * "Fonts don't fit on the profile tab."
 *
 * Measured at 320px: the programme needed 206px and had 152px, and a long name
 * needed 287px in a 232px slot — both truncated. Self-inflicted in the
 * sheet→screen conversion: the programme went into the header's EYEBROW, which
 * shares its row with the three action buttons and so gets only the narrow
 * half of it, when as a sheet it had a full-width row under the name.
 *
 * So the identity goes back to its own full-width block, and a person's name
 * wraps rather than truncating — losing "-Svobodová" is worse than a second
 * line.
 */
describe('ProfileScreen fits its text', () => {
  beforeEach(() => {
    const plan = { title: PROGRAMME, blocks: [] } as unknown as StudyPlan;
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      fullName: LONG_NAME,
      studentId: '123456',
      studyPlanDual: { cz: plan, en: plan },
      hiddenItems: { events: [], courses: [] },
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });

  it('keeps the programme out of the header, where the buttons squeeze it', () => {
    render(<ProfileScreen />);
    const header = screen.getByText('Profil').closest('[class*="pt-["]');
    expect(header).not.toBeNull();
    expect(header!.textContent).not.toContain(PROGRAMME);
  });

  it('still shows the programme, on its own full-width row', () => {
    render(<ProfileScreen />);
    expect(screen.getByText(PROGRAMME)).toBeInTheDocument();
  });

  it('lets a long name wrap instead of cutting it off', () => {
    render(<ProfileScreen />);
    const name = screen.getByText(LONG_NAME);
    expect(name.className).not.toContain('truncate');
  });

  it('shows the whole name, not an elided one', () => {
    render(<ProfileScreen />);
    expect(screen.getByText(LONG_NAME).textContent).toBe(LONG_NAME);
  });
});
