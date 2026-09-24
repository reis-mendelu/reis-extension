import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { ReportMissingLink } from '../ReportMissingLink';

beforeEach(() => useAppStore.setState({ language: 'cz', reportOpen: false, reportPrefill: null }));
afterEach(cleanup);

describe('ReportMissingLink', () => {
  it('reads as a question, not an error', () => {
    render(<ReportMissingLink prefill="examsEmpty" />);
    expect(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeInTheDocument();
  });

  it('opens the report form prefilled with its own section title', () => {
    render(<ReportMissingLink prefill="examsEmpty" />);
    fireEvent.click(screen.getByRole('button'));
    expect(useAppStore.getState()).toMatchObject({
      reportOpen: true,
      reportPrefill: { title: 'Zkoušky: prázdný seznam' },
    });
  });

  it('has a phone-sized touch target', () => {
    render(<ReportMissingLink prefill="examsEmpty" />);
    expect(screen.getByRole('button')).toHaveClass('min-h-11');
  });
});
