import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../../../data/societies';
import { trackFeatureSignal } from '../../../../../api/featureUsage';
import { openExternal } from '../../../../../mobile/openExternal';
import { StudyAidsRow } from '../StudyAidsRow';

vi.mock('../../../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));
vi.mock('../../../../../mobile/openExternal', () => ({
  openExternal: vi.fn(() => Promise.resolve()),
}));

// The phone's half of the study-aids link (the extension's is StudyAidsLink).
// A NavRow that leaves the app, so the in-app browser opens it, not the system one.
describe('StudyAidsRow (phone)', () => {
  beforeEach(() => {
    vi.mocked(trackFeatureSignal).mockClear();
    vi.mocked(openExternal).mockClear();
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

  it('shows the row, with what is behind it, to a student of a listed programme', () => {
    render(<StudyAidsRow />);
    expect(screen.getByRole('button', { name: /Studijní opory k předmětům/ })).toBeInTheDocument();
    expect(screen.getByText(/Prezentace, simulace a kvízy/)).toBeInTheDocument();
  });

  it('opens mendelu.app in the in-app browser and counts the click under its own label', () => {
    render(<StudyAidsRow />);
    fireEvent.click(screen.getByRole('button', { name: /Studijní opory k předmětům/ }));
    expect(openExternal).toHaveBeenCalledWith('https://mendelu.app/');
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_mendelu_app');
  });

  it('renders nothing, and counts nothing, for a student of another programme', () => {
    useAppStore.setState({ userProgramme: 'B-FYT' } as never);
    const { container } = render(<StudyAidsRow />);
    expect(container.firstChild).toBeNull();
    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });

  it('follows the admin console: switched off, it disappears', () => {
    const societies = useAppStore.getState().societies;
    useAppStore.setState({
      societies: { ...societies, 'mendelu-app': { ...societies['mendelu-app']!, isActive: false } },
    } as never);
    const { container } = render(<StudyAidsRow />);
    expect(container.firstChild).toBeNull();
  });
});
