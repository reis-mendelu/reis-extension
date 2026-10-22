import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { ZaznamnikTab } from '../../SubjectFileDrawer/ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

// The teacher's "Pokyny" (IS shows them only behind an icon's popup). The card
// is rendered by ZaznamnikTab on the extension, the phone and the iPad alike.
const POKYNY = 'Odevzdejte zdrojové kódy.\n- obrázek <b>modelu</b>,\n\nNení možné používat AI.';

describe('submission box — Pokyny', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      subjects: { data: { 'EBC-PJ': { hasPrubezne: true, hasTest: false, subjectId: 'P1' } } },
      odevzdavarny: [
        box({
          name: 'S pokyny',
          deadline: '05.10.2026 10:00',
          odevzdavarnaId: '1',
          instructions: POKYNY,
        }),
        box({ name: 'Bez pokynů', deadline: '06.10.2026 10:00', odevzdavarnaId: '2' }),
      ],
    } as never);
  });
  afterEach(cleanup);

  it('shows them folded under the box, with a preview of the first line', () => {
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    const card = screen.getByTestId('submission-box-1');
    const pokyny = within(card).getByTestId('box-instructions');
    expect(pokyny.tagName).toBe('DETAILS');
    expect(pokyny.hasAttribute('open')).toBe(false);
    const summary = pokyny.querySelector('summary')!;
    expect(summary.textContent).toContain('Pokyny');
    expect(summary.textContent).toContain('Odevzdejte zdrojové kódy.');
  });

  it('keeps line breaks and never renders the text as HTML', () => {
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    const details = screen.getByTestId('box-instructions') as HTMLDetailsElement;
    expect(within(details).queryByTestId('box-instructions-text')).toBeNull();
    details.open = true;
    fireEvent(details, new Event('toggle'));
    const body = within(details).getByTestId('box-instructions-text');
    expect(details.querySelector('summary')!.textContent).not.toContain('Odevzdejte');
    expect(body.textContent).toBe(POKYNY);
    expect(body.className).toContain('whitespace-pre-line');
    expect(body.querySelector('b')).toBeNull();
  });

  it('sits outside the link, so opening it does not navigate to IS', () => {
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    const card = screen.getByTestId('submission-box-1');
    expect(screen.getByTestId('box-instructions').closest('a')).toBeNull();
    expect(card.querySelector('a')?.getAttribute('href')).toContain('odevzdavarna=1');
  });

  it('shows nothing for a box without them', () => {
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    const card = screen.getByTestId('submission-box-2');
    expect(within(card).queryByTestId('box-instructions')).toBeNull();
    expect(card.textContent).not.toContain('Pokyny');
  });

  it('speaks English too', () => {
    useAppStore.setState({ language: 'en' } as never);
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    expect(screen.getByTestId('box-instructions').querySelector('summary')!.textContent).toContain(
      'Instructions'
    );
  });
});
