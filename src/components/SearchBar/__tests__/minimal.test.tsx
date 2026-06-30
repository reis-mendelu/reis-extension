import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SearchBar } from '../index';
import { useAppStore } from '../../../store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ language: 'cz', studiumId: '', obdobiId: '', facultyId: '' });
});

describe('SearchBar minimal mode', () => {
  it('renders just the input — no IS-portal launcher button', () => {
    render(<SearchBar minimal />);
    // Empty query → no clear button; minimal → no launcher button. So zero buttons.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('full mode still renders the IS-portal launcher button', () => {
    render(<SearchBar />);
    expect(screen.queryByRole('button')).not.toBeNull();
  });
});
