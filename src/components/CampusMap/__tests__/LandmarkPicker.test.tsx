import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandmarkPicker } from '../LandmarkPicker';
import { useAppStore } from '../../../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ mapSelection: null, mapFocusRequest: 0, language: 'en' });
});

describe('LandmarkPicker', () => {
  it('renders both group headers and every off-campus place', () => {
    render(<LandmarkPicker />);
    expect(screen.getByText('Campus')).toBeTruthy();
    // "Other places", not "Other sites" — the group now holds one venue that is
    // not MENDELU's (Panská lícha), so the heading must not call it a site of ours.
    expect(screen.getByText('Other places')).toBeTruthy();
    expect(screen.getByText('Botanická zahrada a arboretum')).toBeTruthy();
    expect(screen.getByText('Zahradnická fak. – Lednice')).toBeTruthy();
    expect(screen.getByText('ŠZP Žabčice')).toBeTruthy();
    expect(screen.getByText('ŠLP Křtiny')).toBeTruthy();
    expect(screen.getByText('Panská lícha')).toBeTruthy();
  });

  it('clicking Panská lícha flies to it — the one place here MENDELU does not own', async () => {
    render(<LandmarkPicker />);
    await userEvent.click(screen.getByText('Panská lícha'));
    const s = useAppStore.getState();
    expect(s.mapSelection).toMatchObject({ kind: 'poi', poi: { id: -105 } });
    expect(s.mapFocusRequest).toBe(1);
  });

  it('clicking a remote site flies to it (poi selection at its id)', async () => {
    render(<LandmarkPicker />);
    await userEvent.click(screen.getByText('ŠLP Křtiny'));
    const s = useAppStore.getState();
    expect(s.mapSelection).toMatchObject({ kind: 'poi', poi: { id: -104 } });
    expect(s.mapFocusRequest).toBe(1);
  });
});
