import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { useEscapeLayer } from '../useEscapeLayer';
import { useAppStore } from '../../../store/useAppStore';
import { CountryPicker } from '../../../components/ErasmusPanel/CountryPicker';
import { UniversityPicker } from '../../../components/ErasmusPanel/UniversityPicker';
import { ComposerTimeField } from '../../../components/CampusMap/ComposerTimeField';
import { EditableCourseTitle } from '../../../components/SubjectFileDrawer/Header/EditableCourseTitle';
import { FeedbackModalHost } from '../../../components/Feedback/FeedbackModalHost';

vi.mock('@/hooks/data/useErasmus', () => ({
  useErasmus: () => ({ setCountry: vi.fn(), countryFile: null, reports: [] }),
}));
vi.mock('@/hooks/data/useUniversities', () => ({
  useUniversities: () => ({
    universities: [{ name: 'Univerzita Karlova', erasmusCode: 'CZ PRAHA07', city: 'Praha' }],
    loading: false,
  }),
}));

/** The drawer, sheet or panel the control sits in: an Escape layer under it. */
function Under({ onClose }: { onClose: () => void }) {
  useEscapeLayer(true, onClose);
  return null;
}

function TimeHarness() {
  const [v, setV] = useState('');
  return <ComposerTimeField value={v} onChange={setV} t={(k) => k} />;
}

/**
 * A control that uses Escape for itself keeps it — an open list closes, an
 * edit is cancelled — and the drawer, sheet or dialog around it stays. With
 * nothing of its own open, the control leaves the key to the layer under it.
 * Each control calls `preventDefault`, which every layer and the phone's sheet
 * stack yield to (useEscapeLayer, useEscapeClosesSheet).
 */
describe('Escape inside a layer', () => {
  let under: () => void;
  beforeEach(() => {
    under = vi.fn();
    useAppStore.setState({ language: 'cz', courseNicknames: {} } as never);
  });
  afterEach(cleanup);

  const escapeOn = (el: Element) => fireEvent.keyDown(el, { key: 'Escape' });

  it('CountryPicker: the first Escape closes its list, the next one the drawer', () => {
    render(
      <>
        <Under onClose={under} />
        <CountryPicker value="" onChange={() => {}} />
      </>
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    escapeOn(input);
    expect(under).not.toHaveBeenCalled();
    escapeOn(input);
    expect(under).toHaveBeenCalledTimes(1);
  });

  it('UniversityPicker: the first Escape closes its list, the next one the drawer', () => {
    render(
      <>
        <Under onClose={under} />
        <UniversityPicker alpha2="CZ" value="" onChange={() => {}} onSelect={() => {}} />
      </>
    );
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    expect(screen.getByText('Univerzita Karlova')).toBeInTheDocument();
    escapeOn(input);
    expect(under).not.toHaveBeenCalled();
    expect(screen.queryByText('Univerzita Karlova')).toBeNull();
    escapeOn(input);
    expect(under).toHaveBeenCalledTimes(1);
  });

  it('ComposerTimeField: the first Escape closes its list, the next one the panel', () => {
    render(
      <>
        <Under onClose={under} />
        <TimeHarness />
      </>
    );
    const field = screen.getByRole('combobox', { name: 'map.eventTime' });
    fireEvent.keyDown(field, { key: 'ArrowDown' });
    expect(field).toHaveAttribute('aria-expanded', 'true');
    escapeOn(field);
    expect(under).not.toHaveBeenCalled();
    expect(field).toHaveAttribute('aria-expanded', 'false');
    escapeOn(field);
    expect(under).toHaveBeenCalledTimes(1);
  });

  it('EditableCourseTitle: Escape cancels the rename and the drawer stays', () => {
    render(
      <>
        <Under onClose={under} />
        <EditableCourseTitle courseCode="ALG" defaultName="Algoritmizace" language="cz" />
      </>
    );
    fireEvent.click(screen.getByTitle('Nastavit přezdívku'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Algo' } });
    escapeOn(input);
    expect(under).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(useAppStore.getState().courseNicknames.ALG).toBeUndefined();
  });

  it('FeedbackModal: opened over a drawer, Escape closes the form only', () => {
    useAppStore.setState({ reportOpen: false } as never);
    render(
      <>
        <Under onClose={under} />
        <FeedbackModalHost />
      </>
    );
    act(() => useAppStore.getState().openReport());
    expect(useAppStore.getState().reportOpen).toBe(true);
    escapeOn(document.body);
    expect(useAppStore.getState().reportOpen).toBe(false);
    expect(under).not.toHaveBeenCalled();
  });
});
