import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PersonHoverCard } from '../PersonHoverCard';
import { useAppStore } from '../../store/useAppStore';

const usePersonPhoto = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/data/usePersonPhoto', () => ({ usePersonPhoto }));
vi.mock('../../api/search/searchService', () => ({
  fetchPersonProfile: () =>
    Promise.resolve({ id: '42', name: 'Jan Novák', faculty: 'PEF', link: '', type: 'teacher' }),
}));

const PHOTO = 'data:image/jpeg;base64,AAAA';
const ANCHOR = 'doc. Novák';

// isTouch opens the card on click, so the test does not wait out the hover delay.
async function openCard() {
  fireEvent.click(screen.getByText(ANCHOR));
  return screen.findByRole('button', { name: 'Zvětšit fotku' });
}

describe('PersonHoverCard photo', () => {
  beforeEach(() => {
    usePersonPhoto.mockReturnValue(PHOTO);
    useAppStore.setState({ language: 'cz', isTouch: true } as never);
  });

  it('enlarges the photo and steps the card aside', async () => {
    render(<PersonHoverCard personId="42">{ANCHOR}</PersonHoverCard>);
    fireEvent.click(await openCard());
    const lightbox = screen.getByTestId('person-photo-lightbox');
    expect(lightbox.querySelector('img')).toHaveAttribute('src', PHOTO);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Zvětšit fotku' })).toBeNull());
  });

  it('survives the card going away, and the card opens again afterwards', async () => {
    render(<PersonHoverCard personId="42">{ANCHOR}</PersonHoverCard>);
    fireEvent.click(await openCard());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('person-photo-lightbox')).toBeNull();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Zvětšit fotku' })).toBeNull());
    expect(await openCard()).toBeInTheDocument();
  });

  it('offers nothing to enlarge without a photo', async () => {
    usePersonPhoto.mockReturnValue(null);
    render(<PersonHoverCard personId="42">{ANCHOR}</PersonHoverCard>);
    fireEvent.click(screen.getByText(ANCHOR));
    await screen.findByText('Jan Novák');
    expect(screen.queryByRole('button', { name: 'Zvětšit fotku' })).toBeNull();
  });
});
