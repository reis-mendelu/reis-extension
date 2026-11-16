import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { useAppStore } from '../../../../store/useAppStore';

const { openExternal } = vi.hoisted(() => ({ openExternal: vi.fn() }));
vi.mock('../../../../mobile/openExternal', () => ({ openExternal }));

describe('Nápověda on Profil', () => {
  beforeEach(() => {
    openExternal.mockReset().mockResolvedValue(undefined);
    useAppStore.setState({
      mobileSheets: [],
      fullName: 'Jana Nováková',
      studentId: '123456',
      hiddenItems: { events: [], courses: [] },
      studyPlanDual: null,
    } as never);
  });

  it('opens the guide index, directly above Nahlásit chybu', () => {
    useAppStore.setState({ language: 'cz' });
    render(<ProfileScreen />);
    const help = screen.getByRole('button', { name: 'Nápověda' });
    const report = screen.getByRole('button', { name: /Nahlásit chybu/ });
    expect(help.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(help);
    expect(openExternal).toHaveBeenCalledWith('https://reisapp.cz/navody?z=app');
  });

  it('opens the English index in English', () => {
    useAppStore.setState({ language: 'en' });
    render(<ProfileScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(openExternal).toHaveBeenCalledWith('https://reisapp.cz/en/guides?z=app');
  });
});
