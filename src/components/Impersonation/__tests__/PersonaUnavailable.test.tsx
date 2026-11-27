import { it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { PersonaUnavailable } from '../PersonaUnavailable';

beforeEach(() => useAppStore.setState({ language: 'cz' }));
afterEach(cleanup);

it('names what a persona cannot have and why, in Czech', () => {
  render(<PersonaUnavailable what="exams" />);
  const note = screen.getByTestId('persona-unavailable');
  expect(note).toHaveAttribute('role', 'note');
  expect(note).toHaveTextContent(
    'Persona · Zkoušky: není k dispozici — IS to dává jen přihlášenému studentovi.'
  );
});

it('and in English', () => {
  useAppStore.setState({ language: 'en' });
  render(<PersonaUnavailable what="files" />);
  expect(screen.getByTestId('persona-unavailable')).toHaveTextContent(
    'Persona · Files: not available — IS gives this only to the signed-in student.'
  );
});

/** It explains our gap; a report link beside it would invite reporting that gap. */
it('offers no report link', () => {
  render(<PersonaUnavailable what="zaznamnik" />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
