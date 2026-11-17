/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IsNoticesPanel } from '../IsNoticesPanel';
import { useAppStore } from '../../../store/useAppStore';

const setIsNoticeMuted = vi.fn().mockResolvedValue(true);

beforeEach(() => {
  setIsNoticeMuted.mockClear();
  useAppStore.setState({
    language: 'cz',
    isNotices: {
      cz: [
        {
          key: 'zasadka:157890',
          title: 'Nový design UIS',
          text: '',
          link: null,
          severity: 'info',
          from: null,
          until: null,
        },
      ],
      en: [],
    },
    isNoticeMutes: [{ key: 'link:/auth/kontrola/', title: 'Kontrola osobních údajů' }],
    setIsNoticeMuted,
  } as any);
});

describe('IsNoticesPanel', () => {
  it("lists the admin's own IS notices and the muted ones no longer there", () => {
    render(<IsNoticesPanel />);
    expect(screen.getByText('Nový design UIS')).toBeInTheDocument();
    expect(screen.getByText('Kontrola osobních údajů')).toBeInTheDocument();
    expect(screen.getByText('Skryto · Už není ve tvém IS')).toBeInTheDocument();
  });

  it('mutes a visible notice for everyone', async () => {
    render(<IsNoticesPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Skrýt všem' }));
    await waitFor(() =>
      expect(setIsNoticeMuted).toHaveBeenCalledWith(
        { key: 'zasadka:157890', title: 'Nový design UIS', inMyIs: true },
        true
      )
    );
  });

  it('un-mutes a muted one', async () => {
    render(<IsNoticesPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit' }));
    await waitFor(() =>
      expect(setIsNoticeMuted).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'link:/auth/kontrola/' }),
        false
      )
    );
  });
});
