import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { trackFeatureSignal } from '../../../api/featureUsage';
import { StudyAidsLink } from '../StudyAidsLink';

vi.mock('../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));

// The extension's half of the study-aids link (the phone's is StudyAidsRow).
// A plain link: the extension has a real browser, so it opens in a new tab.
describe('StudyAidsLink (extension)', () => {
  beforeEach(() => {
    vi.mocked(trackFeatureSignal).mockClear();
    useAppStore.setState({
      language: 'cz',
      societies: {
        ...BUNDLED_SOCIETIES,
        'mendelu-app': {
          ...BUNDLED_SOCIETIES.ey!,
          id: 'mendelu-app',
          name: 'mendelu.app',
          audience: ['af:B-ATE'],
        },
      },
      userFaculty: 'AF',
      userProgramme: 'B-ATE',
      isErasmus: false,
      impersonation: null,
    } as never);
  });

  it('links a student of a listed programme to mendelu.app in a new tab', () => {
    render(<StudyAidsLink />);
    const link = screen.getByRole('link', { name: /Studijní opory k předmětům/ });
    expect(link).toHaveAttribute('href', 'https://mendelu.app/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders nothing for a student of another programme', () => {
    useAppStore.setState({ userProgramme: 'B-FYT' } as never);
    const { container } = render(<StudyAidsLink />);
    expect(container.firstChild).toBeNull();
  });

  it('counts a click under its own label, and a middle-click but not a right-click', () => {
    render(<StudyAidsLink />);
    const link = screen.getByRole('link', { name: /Studijní opory k předmětům/ });
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    expect(trackFeatureSignal).not.toHaveBeenCalled();
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_mendelu_app');
    vi.mocked(trackFeatureSignal).mockClear();
    fireEvent.click(link);
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_mendelu_app');
  });

  it('counts nothing for a student who is shown no link', () => {
    useAppStore.setState({ userProgramme: 'B-FYT' } as never);
    render(<StudyAidsLink />);
    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });
});
