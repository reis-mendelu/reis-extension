import { it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EmptyExamsState } from '../EmptyExamsState';

beforeEach(() => useAppStore.setState({ language: 'cz', reportOpen: false, reportPrefill: null }));
afterEach(cleanup);

it('offers to report a missing exam list', () => {
  render(<EmptyExamsState />);
  fireEvent.click(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' }));
  expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Zkoušky: prázdný seznam' });
});
