import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { trackFeatureSignal } from '../../../api/featureUsage';
import { StudyAidsLink } from '../StudyAidsLink';

vi.mock('../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));

// The extension's half of the study-aids link (the phone's is StudyAidsRow).
// A plain link: the extension has a real browser, so it opens in a new tab.
// Who sees it is `studyAids` in the store, the active rows of `study_aids`.
describe('StudyAidsLink (extension)', () => {
  beforeEach(() => {
    vi.mocked(trackFeatureSignal).mockClear();
    useAppStore.setState({
      language: 'cz',
      studyAids: { 'mendelu-app': ['af:B-ATE'] },
      userFaculty: 'AF',
      userProgramme: 'B-ATE',
      isErasmus: false,
      impersonation: null,
    } as never);
  });

  it('links a student of a listed programme to mendelu.app in a new tab', () => {
    render(<StudyAidsLink />);
    const link = screen.getByRole('link', { name: /Studijní opory/ });
    expect(link).toHaveAttribute('href', 'https://mendelu.app/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders nothing for a student of another programme', () => {
    useAppStore.setState({ userProgramme: 'B-FYT' } as never);
    const { container } = render(<StudyAidsLink />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing while the admin has the link switched off', () => {
    useAppStore.setState({ studyAids: {} } as never);
    const { container } = render(<StudyAidsLink />);
    expect(container.firstChild).toBeNull();
  });

  it('counts a click under its own label, and a middle-click but not a right-click', () => {
    render(<StudyAidsLink />);
    const link = screen.getByRole('link', { name: /Studijní opory/ });
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    expect(trackFeatureSignal).not.toHaveBeenCalled();
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_mendelu_app');
    vi.mocked(trackFeatureSignal).mockClear();
    fireEvent.click(link);
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_mendelu_app');
  });

  it("links a B-OI student to their programme's Discord, beside mendelu.app when both match", () => {
    useAppStore.setState({
      studyAids: {
        'mendelu-app': ['pef'],
        'discord-b-oi': ['pef:B-OI'],
        'discord-b-aii': ['pef:B-AII'],
      },
      userFaculty: 'PEF',
      userProgramme: 'B-OI',
    } as never);
    render(<StudyAidsLink />);
    const discord = screen.getByRole('link', { name: /Discord · Otevřená informatika/ });
    expect(discord).toHaveAttribute('href', 'https://discord.gg/fN9XrTqmVf');
    expect(discord).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: /Studijní opory/ })).toBeInTheDocument();
    // The other programme's server is not offered.
    expect(screen.queryByRole('link', { name: /Administrace/ })).toBeNull();
    fireEvent.click(discord);
    expect(trackFeatureSignal).toHaveBeenCalledWith('study_aids_click_discord_b_oi');
  });

  it('links a B-AII student to the administrace server only', () => {
    useAppStore.setState({
      studyAids: { 'discord-b-oi': ['pef:B-OI'], 'discord-b-aii': ['pef:B-AII'] },
      userFaculty: 'PEF',
      userProgramme: 'B-AII',
    } as never);
    render(<StudyAidsLink />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Discord · Administrace/ })).toHaveAttribute(
      'href',
      'https://discord.gg/THue2RgVr2'
    );
  });

  it('counts nothing for a student who is shown no link', () => {
    useAppStore.setState({ userProgramme: 'B-FYT' } as never);
    render(<StudyAidsLink />);
    expect(trackFeatureSignal).not.toHaveBeenCalled();
  });
});
