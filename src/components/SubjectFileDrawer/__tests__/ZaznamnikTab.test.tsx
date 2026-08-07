import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ZaznamnikTab } from '../ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';

/**
 * The phone renders this tab inside a sheet that already pins ONE IS link in its
 * footer. Every other tab honours `showIsBacklink` for exactly that reason;
 * záznamník rendered its own pair unconditionally, so the sheet showed a
 * duplicate link on this tab alone.
 */
describe('ZaznamnikTab IS backlinks', () => {
  beforeEach(() => {
    useAppStore.setState({
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      subjects: {
        data: { EBC: { hasPrubezne: true, hasTest: true, subjectId: '789' } },
      },
    } as never);
  });

  afterEach(cleanup);

  it('renders the IS backlinks by default, as the desktop drawer expects', () => {
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.getAllByRole('link').length).toBe(2);
  });

  it('renders none when the host pins its own IS link', () => {
    render(<ZaznamnikTab courseCode="EBC" showIsBacklink={false} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
