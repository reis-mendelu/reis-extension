import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../../../../store/useAppStore';
import { trackFeatureSignal } from '../../../../../api/featureUsage';
import { openExternal } from '../../../../../mobile/openExternal';
import { StudyAidsRow } from '../StudyAidsRow';

vi.mock('../../../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));
vi.mock('../../../../../mobile/openExternal', () => ({
  openExternal: vi.fn(() => Promise.resolve()),
}));

// The phone's half of the study-aids link (the extension's is StudyAidsLink).
// A NavRow that leaves the app: a third-party host goes to the real browser
// view through openExternal. Who sees it is `studyAids` in the store, the
// active rows of `study_aids` that the admin console edits.
describe('StudyAidsRow (phone)', () => {
  beforeEach(() => {
    vi.mocked(trackFeatureSignal).mockClear();
    vi.mocked(openExternal).mockClear();
    useAppStore.setState({
      language: 'cz',
      studyAids: { 'mendelu-app': ['af:B-ATE'] },
      userFaculty: 'AF',
      userProgramme: 'B-ATE',
      isErasmus: false,
      impersonation: null,
    } as never);
  });

  it('shows the row, with what is behind it, to a student of a listed programme', () => {
    render(<StudyAidsRow />);
    expect(screen.getByRole('button', { name: /Studijní opory/ })).toBeInTheDocument();
    // Only the domain, nothing to cut: NavRow truncates its sublabel, and a
    // longer description was cut mid-word at 390px ("…simulace a kví…").
    expect(screen.getByText('mendelu.app')).toBeInTheDocument();
  });

  it('hands mendelu.app to openExternal and counts the click under its own label', () => {
    render(<StudyAidsRow />);
    fireEvent.click(screen.getByRole('button', { name: /Studijní opory/ }));
    expect(openExternal).toHaveBeenCalledWith('https://mendelu.app/');
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_mendelu_app');
  });

  it('renders nothing, and counts nothing, for a student of another programme', () => {
    useAppStore.setState({ userProgramme: 'B-FYT' } as never);
    const { container } = render(<StudyAidsRow />);
    expect(container.firstChild).toBeNull();
    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });

  it("shows a B-OI student their programme's Discord and hands the invite to openExternal", () => {
    useAppStore.setState({
      studyAids: {
        'mendelu-app': ['pef'],
        'discord-b-oi': ['pef:B-OI'],
        'discord-b-aii': ['pef:B-AII'],
      },
      userFaculty: 'PEF',
      userProgramme: 'B-OI',
    } as never);
    render(<StudyAidsRow />);
    expect(screen.getByRole('button', { name: /Studijní opory/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Administrace/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Discord · Otevřená informatika/ }));
    expect(openExternal).toHaveBeenCalledWith('https://discord.gg/fN9XrTqmVf');
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_discord_b_oi');
  });

  it('shows a B-AII student the administrace server only', () => {
    useAppStore.setState({
      studyAids: { 'discord-b-oi': ['pef:B-OI'], 'discord-b-aii': ['pef:B-AII'] },
      userFaculty: 'PEF',
      userProgramme: 'B-AII',
    } as never);
    render(<StudyAidsRow />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Discord · Administrace/ }));
    expect(openExternal).toHaveBeenCalledWith('https://discord.gg/THue2RgVr2');
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_discord_b_aii');
  });

  it('follows the admin console: switched off, it disappears', () => {
    useAppStore.setState({ studyAids: {} } as never);
    const { container } = render(<StudyAidsRow />);
    expect(container.firstChild).toBeNull();
  });
});
