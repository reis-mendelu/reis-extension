import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuideLink } from '../GuideLink';
import { useAppStore } from '../../../store/useAppStore';

describe('GuideLink', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' }));

  it('opens the troubleshooting section, named as a question', () => {
    render(<GuideLink guide="eduroam" section="troubleshoot" />);
    const link = screen.getByRole('link', { name: 'Proč to nejde?' });
    expect(link).toHaveAttribute(
      'href',
      'https://reisapp.cz/navody/eduroam?z=app&utm_source=reis-app#nefunguje'
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('opens the official way as "Jiný postup"', () => {
    render(<GuideLink guide="isic" section="official" />);
    expect(screen.getByRole('link', { name: 'Jiný postup' })).toHaveAttribute(
      'href',
      'https://reisapp.cz/navody/dobiti-isic?z=app&utm_source=reis-app#oficialne'
    );
  });

  it('follows the app language', () => {
    useAppStore.setState({ language: 'en' });
    render(<GuideLink guide="subjects" section="official" />);
    expect(screen.getByRole('link', { name: 'Another way' })).toHaveAttribute(
      'href',
      'https://reisapp.cz/en/guides/subjects?z=app&utm_source=reis-app#official'
    );
  });
});
