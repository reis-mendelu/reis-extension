import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudyDocumentsPopover } from '../StudyDocumentsPopover';
import { useAppStore } from '../../../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ studiumId: '149707', language: 'cz' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StudyDocumentsPopover', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<StudyDocumentsPopover isOpen={false} onClose={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('lists documents from both sections when open', () => {
    render(<StudyDocumentsPopover isOpen onClose={() => {}} />);
    // Plain-only documents prove both sections rendered.
    expect(screen.getByText('Registrační arch')).toBeTruthy();
    expect(screen.getByText('Žádost na studijní oddělení')).toBeTruthy();
    // "Potvrzení o studiu" appears in both sealed and plain sections.
    expect(screen.getAllByText('Potvrzení o studiu').length).toBeGreaterThanOrEqual(2);
  });

  it('opens the exact IS download URL in a new tab when a document is clicked', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<StudyDocumentsPopover isOpen onClose={() => {}} />);
    await userEvent.click(screen.getByText('Registrační arch'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/student/tisk_dokumentu.pl?reg_arch_tisk=1;studium=149707;lang=cz',
      '_blank'
    );
  });

  it('shows the unavailable message and no document rows without a studiumId', () => {
    useAppStore.setState({ studiumId: null });
    render(<StudyDocumentsPopover isOpen onClose={() => {}} />);
    expect(screen.queryByText('Registrační arch')).toBeNull();
  });
});
