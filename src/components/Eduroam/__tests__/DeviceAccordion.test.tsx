import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DeviceAccordion } from '../DeviceAccordion';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => {
  cleanup();
  useAppStore.setState({ language: 'en' });
});

const base = {
  status: 'idle' as const,
  qrDataUrl: null,
  password: null,
  onSelect: () => {},
  onRestart: () => {},
  onRun: () => {},
  onOpenSettings: () => {},
};

describe('DeviceAccordion', () => {
  // Phones are configured by the reIS app itself, so the browser offers only
  // the machine it is running on.
  it('renders only the desktop device cards, never a phone', () => {
    useAppStore.setState({ language: 'en' });
    render(<DeviceAccordion selected={null} {...base} />);
    expect(screen.getByRole('button', { name: /Mac/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Windows/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /iPhone/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Android/i })).toBeNull();
  });

  it('calls onSelect with the device id when a card is clicked', () => {
    useAppStore.setState({ language: 'en' });
    const onSelect = vi.fn();
    render(<DeviceAccordion selected={null} {...base} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Windows/i }));
    expect(onSelect).toHaveBeenCalledWith('windows');
  });

  it('marks the selected card aria-expanded and shows the tutorial', () => {
    useAppStore.setState({ language: 'en' });
    render(<DeviceAccordion selected="mac" {...base} />);
    expect(screen.getByRole('button', { name: /Mac/i }).getAttribute('aria-expanded')).toBe('true');
    // Step 2 heading from the tutorial
    expect(screen.getByText('Set up eduroam')).toBeTruthy();
  });

  it('clicking the already-selected card goes back to the chooser via onRestart', () => {
    useAppStore.setState({ language: 'en' });
    const onRestart = vi.fn();
    const onSelect = vi.fn();
    render(<DeviceAccordion selected="mac" {...base} onRestart={onRestart} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Mac/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onRestart from the "pick another device" button', () => {
    useAppStore.setState({ language: 'en' });
    const onRestart = vi.fn();
    render(<DeviceAccordion selected="mac" {...base} onRestart={onRestart} />);
    fireEvent.click(screen.getByRole('button', { name: /Pick another device/i }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
