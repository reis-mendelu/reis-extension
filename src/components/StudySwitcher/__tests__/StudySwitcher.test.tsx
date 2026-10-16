import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudySwitcher } from '../StudySwitcher';
import { ProfileIdentity } from '../../mobile/screens/profile/ProfileIdentity';
import { useAppStore } from '../../../store/useAppStore';

const AII = {
  studium: '900011',
  obdobi: '829',
  label: 'PEF B-AII prez [sem 1, roč 1]',
  isErasmus: false,
};
const EM = {
  studium: '900012',
  obdobi: '829',
  label: 'PEF B-EM komb [sem 1, roč 1]',
  isErasmus: false,
};

describe('StudySwitcher', () => {
  const switchStudy = vi.fn();

  beforeEach(() => {
    switchStudy.mockReset().mockResolvedValue(true);
    useAppStore.setState({
      language: 'cz',
      studies: [AII, EM],
      studiumId: '900011',
      studySwitching: false,
      switchStudy,
    } as never);
  });

  // Nearly every student: one study, and nothing new on screen.
  it('renders nothing for a single-study student', () => {
    useAppStore.setState({ studies: [AII] } as never);
    const { container } = render(<StudySwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('lists both active studies and marks the one in use', () => {
    render(<StudySwitcher />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual([
      'PEF B-AII prezsem 1, roč 1',
      'PEF B-EM kombsem 1, roč 1',
    ]);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(radios[1]).toHaveAttribute('aria-checked', 'false');
  });

  it('switches when the other study is picked, and not for the current one', async () => {
    render(<StudySwitcher />);
    fireEvent.click(screen.getByRole('radio', { name: /B-AII/ }));
    expect(switchStudy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('radio', { name: /B-EM/ }));
    await waitFor(() => expect(switchStudy).toHaveBeenCalledWith('900012'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says so when the switch failed', async () => {
    switchStudy.mockResolvedValue(false);
    render(<StudySwitcher />);
    fireEvent.click(screen.getByRole('radio', { name: /B-EM/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('nepodařilo');
  });

  // The phone/iPad tree. The desktop tree's ProfilePopup renders the same
  // component (compact) — see desktopHasStudySwitcher in the guards.
  it('is on the phone Profile tab under the name', () => {
    useAppStore.setState({ fullName: 'Jana Nováková', studentId: '100001' } as never);
    render(<ProfileIdentity />);
    expect(screen.getByTestId('study-switcher')).toBeInTheDocument();
  });
});
