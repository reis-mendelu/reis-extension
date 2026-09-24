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

  // A grey text link read as a caption, not something to tap. An outlined
  // button in neutral ink is unmistakably tappable without the error or
  // primary colour that would say the empty list is wrong.
  it('reads as a neutral button with an icon, not a caption', () => {
    render(<ReportMissingLink prefill="examsEmpty" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('btn-outline', 'text-base-content');
    expect(button).not.toHaveClass('btn-link', 'btn-primary', 'btn-error');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('has a phone-sized touch target', () => {
    render(<ReportMissingLink prefill="examsEmpty" />);
    expect(screen.getByRole('button')).toHaveClass('min-h-11');
  });
});
