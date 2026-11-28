import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { overlayWrite } from '../../../store/overlay/overlayGuard';
import { PersonaList } from '../PersonaList';
import { PERSONAS, personaName } from '../../../features/personas';

const active = (personaId?: string) => ({
  selection: {
    programId: '1889',
    shortCode: 'B-F',
    name: 'Finance',
    faculty: 'PEF',
    year: 1,
    group: 2,
    periodLabel: 'ZS 2026/2027',
    rozvrh: {} as never,
    ...(personaId ? { personaId } : {}),
  },
  result: {
    resolved: { programId: '1889', shortCode: 'B-F', rozvrh: {} as never },
    plan: {} as never,
    schedule: [],
    subjects: { version: 1, lastUpdated: '', data: {} },
    fetchedAt: 0,
  },
});

const radios = () => screen.getAllByRole('radio');
const checked = () =>
  radios()
    .filter((r) => r.getAttribute('aria-checked') === 'true')
    .map((r) => r.textContent);

beforeEach(() =>
  useAppStore.setState(
    overlayWrite({ impersonation: null, personaRows: {}, language: 'cz' as const })
  )
);

describe('PersonaList', () => {
  it('lists Já, the eight personas, then Jiný obor…, with Já checked by default', () => {
    render(<PersonaList variant="compact" onOther={() => {}} />);
    const labels = radios().map((r) => r.textContent);
    expect(labels[0]).toContain('Já');
    PERSONAS.forEach((p, i) =>
      expect(labels[i + 1]).toContain(`${personaName(p, 'cz')}${p.faculty}`)
    );
    expect(labels[1]).toContain('IT · B-OI');
    expect(labels[1]).toContain('PEF');
    // Erasmus last before Jiný obor…, named by its faculty: no programme to show.
    expect(labels[8]).toContain('Erasmus · PEF');
    expect(labels.join()).not.toContain('null');
    expect(labels[9]).toContain('Jiný obor…');
    expect(checked()).toHaveLength(1);
    expect(checked()[0]).toContain('Já');
  });

  it('checks the active persona and switches on a tap', () => {
    const go = vi.fn(async () => true);
    useAppStore.setState(overlayWrite({ impersonation: active('finance'), switchToPersona: go }));
    render(<PersonaList variant="touch" onOther={() => {}} />);
    expect(checked()).toEqual([expect.stringContaining('Finance · B-F')]);
    fireEvent.click(screen.getByRole('radio', { name: /IT · B-OI/ }));
    expect(go).toHaveBeenCalledWith('it');
  });

  it('Já exits a persona', () => {
    const stop = vi.fn(async () => {});
    useAppStore.setState(
      overlayWrite({ impersonation: active('finance'), stopImpersonation: stop })
    );
    render(<PersonaList variant="compact" onOther={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: /Já/ }));
    expect(stop).toHaveBeenCalledOnce();
  });

  it('a one-off from the picker checks Jiný obor… and names its code', () => {
    useAppStore.setState(overlayWrite({ impersonation: active() }));
    render(<PersonaList variant="compact" onOther={() => {}} />);
    expect(checked()).toEqual([expect.stringMatching(/Jiný obor….*B-F/)]);
  });

  it('shows a spinner on the fetching row, holds the other personas, and an error line on a failed one', () => {
    const go = vi.fn(async () => true);
    useAppStore.setState({
      personaRows: { economics: 'loading', zf: 'timetable' },
      switchToPersona: go,
    });
    render(<PersonaList variant="compact" onOther={() => {}} />);
    const economics = screen.getByRole('radio', { name: /Ekonomika · B-EM/ });
    expect(within(economics).getByTestId('persona-spinner')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Správa zeleně · B-RASZ/ }).textContent).toContain(
      'IS nevrátil rozvrh.'
    );
    fireEvent.click(screen.getByRole('radio', { name: /IT · B-OI/ }));
    expect(go).not.toHaveBeenCalled();
  });

  it('Jiný obor… hands over to the picker', () => {
    const other = vi.fn();
    render(<PersonaList variant="touch" onOther={other} />);
    fireEvent.click(screen.getByRole('radio', { name: /Jiný obor…/ }));
    expect(other).toHaveBeenCalledOnce();
  });

  it('Já cancels a first fetch when nothing is active yet', () => {
    const cancel = vi.fn();
    const stop = vi.fn(async () => {});
    useAppStore.setState({
      personaRows: { finance: 'loading' },
      cancelPersonaSwitch: cancel,
      stopImpersonation: stop,
    });
    render(<PersonaList variant="touch" onOther={() => {}} />);
    const ja = screen.getByRole('radio', { name: /Já/ });
    expect(ja).not.toBeDisabled();
    fireEvent.click(ja);
    expect(cancel).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });

  it('Já with a persona active and another fetching ends both: the list is not left locked', () => {
    const cancel = vi.fn();
    const stop = vi.fn(async () => {});
    useAppStore.setState(
      overlayWrite({
        impersonation: active('finance'),
        personaRows: { it: 'loading' },
        cancelPersonaSwitch: cancel,
        stopImpersonation: stop,
      })
    );
    render(<PersonaList variant="compact" onOther={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: /Já/ }));
    expect(cancel).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
  });
});
