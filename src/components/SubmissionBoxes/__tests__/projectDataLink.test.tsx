import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SubmissionBoxCard } from '../SubmissionBoxCard';
import { useAppStore } from '../../../store/useAppStore';
import { overlayWrite } from '../../../store/overlay/overlayGuard';
import { identityOverlay } from '../../../store/overlay/identityOverlay';
import { trackFeatureSignal } from '../../../api/featureUsage';
import { NOW, box } from './boxFixtures';

vi.mock('../../../api/featureUsage', () => ({ trackFeatureSignal: vi.fn() }));

const setViewer = (programme: string | null, faculty = 'PEF', language: 'cz' | 'en' = 'cz') =>
  useAppStore.setState(
    overlayWrite({ userFaculty: faculty, userProgramme: programme, impersonation: null, language })
  );

const renderBox = (over: Parameters<typeof box>[0] = {}) =>
  render(
    <SubmissionBoxCard
      box={box({ courseCode: 'EBC-VWA', ...over })}
      now={NOW.getTime()}
      testId="b"
    />
  );

describe('SubmissionBoxCard — Data pro projekt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ now: NOW } as never);
  });
  afterEach(cleanup);

  it('shows the line to a B-OI student, linking the page', () => {
    setViewer('B-OI');
    renderBox();
    const link = screen.getByTestId('project-data-link');
    expect(link.getAttribute('href')).toBe('https://reisapp.cz/navody/data-pro-projekty');
    expect(link.textContent).toContain('Data pro projekt');
  });

  it('shows it on any subject, and links the English page in English', () => {
    setViewer('B-AII', 'PEF', 'en');
    renderBox({ courseCode: 'EBC-M' });
    expect(screen.getByTestId('project-data-link').getAttribute('href')).toBe(
      'https://reisapp.cz/en/guides/project-data'
    );
  });

  it.each([
    ['another programme', 'B-EM', 'PEF'],
    ['no programme', null, 'PEF'],
    ['another faculty', 'B-OI', 'AF'],
  ])('shows nothing for %s', (_label, programme, faculty) => {
    setViewer(programme, faculty);
    renderBox();
    expect(screen.queryByTestId('project-data-link')).toBeNull();
  });

  it('shows it on a box cached without a course code too', () => {
    setViewer('B-OI');
    renderBox({ courseCode: undefined });
    expect(screen.getByTestId('project-data-link')).toBeTruthy();
  });

  it('follows the impersonated student, not the admin', () => {
    const selection = { faculty: 'PEF', shortCode: 'B-EKO' };
    useAppStore.setState(
      overlayWrite({
        impersonation: { selection, result: {} } as never,
        ...identityOverlay(selection),
        language: 'cz',
      })
    );
    renderBox();
    expect(screen.queryByTestId('project-data-link')).toBeNull();
  });

  it('counts a click and a middle-click, never a right-click', () => {
    setViewer('B-OI');
    renderBox();
    const link = screen.getByTestId('project-data-link');
    fireEvent.click(link);
    expect(trackFeatureSignal).toHaveBeenCalledTimes(1);
    expect(trackFeatureSignal).toHaveBeenCalledWith('project_data_opened');
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(trackFeatureSignal).toHaveBeenCalledTimes(2);
    fireEvent(link, new MouseEvent('auxclick', { bubbles: true, button: 2 }));
    expect(trackFeatureSignal).toHaveBeenCalledTimes(2);
  });
});
