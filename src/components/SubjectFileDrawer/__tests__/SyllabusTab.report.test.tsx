import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { SyllabusTab } from '../SyllabusTab';

vi.mock('../../../hooks/data', () => ({
  useSyllabus: () => ({ syllabus: null, isLoading: false }),
}));
vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));

beforeEach(() => useAppStore.setState({ language: 'cz', reportOpen: false, reportPrefill: null }));
afterEach(cleanup);

it('offers to report an empty syllabus, outside the faded empty text', () => {
  render(<SyllabusTab courseCode="EBC-ALG" />);
  const link = screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' });
  // opacity-40 on an ancestor would drop the link below 4.5:1 contrast.
  expect(link.closest('.opacity-40')).toBeNull();
  fireEvent.click(link);
  expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Sylabus: chybí data' });
});
