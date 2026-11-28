import { it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { StudyAveragesSection } from '../StudyAveragesSection';
import { useAppStore } from '../../../store/useAppStore';
import { setImpersonating } from '../../Impersonation/__tests__/personaTestState';

/**
 * Admin personas, step D (extension). Averages and the year-group standing are
 * personal in IS; a persona has none, and the section used to vanish, which
 * reads as "this student has no grades yet".
 */
beforeEach(() => {
  setImpersonating(false);
  useAppStore.setState({ language: 'cz' });
});
afterEach(cleanup);

it('shows the persona note in place of the averages while impersonating', () => {
  setImpersonating(true);
  render(<StudyAveragesSection studyStats={null} comparison={null} />);
  expect(screen.getByTestId('persona-unavailable')).toHaveTextContent('Průměry a odevzdávárny');
});

it('renders nothing otherwise, as before', () => {
  const { container } = render(<StudyAveragesSection studyStats={null} comparison={null} />);
  expect(container).toBeEmptyDOMElement();
});
