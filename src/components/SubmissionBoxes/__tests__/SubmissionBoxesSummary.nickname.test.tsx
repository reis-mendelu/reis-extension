import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { SubmissionBoxesSummary } from '../SubmissionBoxesSummary';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/** A due row names its subject the way the student renamed it, on both trees. */
describe('SubmissionBoxesSummary — nickname', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      courseNicknames: { 'EBC-PJ': 'Java' },
      odevzdavarny: [box({ deadline: '08.10.2026 23:59' })],
    } as never);
  });
  afterEach(cleanup);

  it("prints the nickname instead of IS's name", () => {
    render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
    expect(screen.getByText('Java')).toBeTruthy();
    expect(screen.queryByText('Programovací jazyk Java')).toBeNull();
  });
});
