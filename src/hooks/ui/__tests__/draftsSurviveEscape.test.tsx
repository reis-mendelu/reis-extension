import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { useEscapeLayer } from '../useEscapeLayer';
import { useEscapeClosesSheet } from '../../../components/mobile/sheets/useEscapeClosesSheet';
import { LowRatingFeedback } from '../../../components/Questions/LowRatingFeedback';
import { IskamTopUpForm } from '../../../components/mobile/sheets/IskamTopUpForm';
import { CustomEventModal } from '../../../components/CustomEventModal';

vi.mock('../../../api/suggestions', () => ({ submitSuggestion: vi.fn() }));

/** The phone's sheet stack, as SheetHost runs it, with one sheet open. */
function Stack() {
  useEscapeClosesSheet();
  return null;
}

/** What the custom-event editor opens over: a layer under it. */
function Under({ onClose }: { onClose: () => void }) {
  useEscapeLayer(true, onClose);
  return null;
}

const SHEET = { kind: 'notifications' };
const sheets = () => useAppStore.getState().mobileSheets;

/**
 * A typed draft is never lost to Escape — the rule the rename field and the
 * report form already keep. On a Mac (and an iPad with a keyboard) Escape is
 * the key that closes a sheet or an editor, and pressed in a field with text
 * in it, it threw that text away: the "why" under a 1–2 star rating in
 * Novinky, the ISKAM top-up amount, a custom event being written. With text
 * in the field the key is kept and nothing closes; an empty field still lets
 * Escape close what it is in.
 */
describe('Escape and a typed draft', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', mobileSheets: [SHEET] } as never));
  afterEach(cleanup);

  it('LowRatingFeedback: the sheet stays while the "why" has text, closes when empty', () => {
    render(
      <>
        <Stack />
        <LowRatingFeedback title="Hodnocení: 1/5" />
      </>
    );
    fireEvent.click(screen.getByRole('button'));
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Nefunguje mi rozvrh' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(sheets()).toEqual([SHEET]);
    expect(field).toHaveValue('Nefunguje mi rozvrh');
    fireEvent.change(field, { target: { value: '' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(sheets()).toEqual([]);
  });

  it('IskamTopUpForm: the sheet stays while an amount is typed', () => {
    render(
      <>
        <Stack />
        <IskamTopUpForm />
      </>
    );
    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: '500' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(sheets()).toEqual([SHEET]);
    expect(field).toHaveValue('500');
  });

  it('CustomEventModal: stays open with a typed title, closes untouched', () => {
    const under = vi.fn();
    const onClose = vi.fn();
    const { unmount } = render(
      <>
        <Under onClose={under} />
        <CustomEventModal
          mode="create"
          initialDate="20261026"
          onSave={() => {}}
          onClose={onClose}
        />
      </>
    );
    fireEvent.change(screen.getAllByRole('textbox')[0]!, { target: { value: 'Konzultace' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(under).not.toHaveBeenCalled();
    unmount();

    render(
      <>
        <Under onClose={under} />
        <CustomEventModal
          mode="create"
          initialDate="20261026"
          onSave={() => {}}
          onClose={onClose}
        />
      </>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(under).not.toHaveBeenCalled();
  });
});
