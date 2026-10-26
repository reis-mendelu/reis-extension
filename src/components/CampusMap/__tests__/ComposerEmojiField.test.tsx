import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ComposerEmojiField } from '../ComposerEmojiField';

const t = (k: string) =>
  ({
    'map.emojiChange': 'Změnit obrázek',
    'map.emojiGroup.sport': 'Sport',
  })[k] ?? k;

describe('ComposerEmojiField', () => {
  it('shows the chosen emoji and its name, with the grid closed', () => {
    render(<ComposerEmojiField value="26f8" onChange={() => {}} t={t} language="cz" />);
    expect(screen.getByRole('button', { name: /Bruslení/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('button', { name: 'Fotbal' })).toBeNull();
  });

  it('opens the grid, picks an emoji and closes', () => {
    const onChange = vi.fn();
    render(<ComposerEmojiField value="1f389" onChange={onChange} t={t} language="cz" />);
    fireEvent.click(screen.getByRole('button', { name: /Párty/ }));
    expect(screen.getByText('Sport')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fotbal' }));
    expect(onChange).toHaveBeenCalledWith('26bd');
    expect(screen.queryByRole('button', { name: 'Fotbal' })).toBeNull();
    // The picked option is gone, so focus goes back to where the grid opened.
    expect(screen.getByRole('button', { name: /Párty/ })).toHaveFocus();
  });

  it('marks the current emoji as pressed in the grid', () => {
    render(<ComposerEmojiField value="26bd" onChange={() => {}} t={t} language="en" />);
    fireEvent.click(screen.getByRole('button', { name: /Football/ }));
    expect(screen.getByRole('button', { name: 'Football', pressed: true })).toBeInTheDocument();
  });
});
