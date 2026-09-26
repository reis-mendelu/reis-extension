import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { ImpersonationPicker } from '../ImpersonationPicker';

const rozvrh = {
  id: '5769',
  z: '1',
  k: '2',
  label: '',
  period: '',
  faculty: 'PEF',
  form: 'prezenční',
  start: '',
  end: '',
};
const bfVariant = { programId: '1889', shortCode: 'B-F', rozvrh };
const bf = {
  ...bfVariant,
  name: 'Finance',
  faculty: 'PEF',
  years: [1, 2, 3],
  variants: [bfVariant],
};
// Real pair from the PEF criteria form: one programme, two IS versions.
const eam = {
  programId: '1892',
  shortCode: 'B-EAM',
  name: 'Ekonomika a management',
  faculty: 'PEF',
  rozvrh,
  years: [1, 2, 3],
  variants: [
    { programId: '1892', shortCode: 'B-EAM', rozvrh },
    { programId: '3066', shortCode: 'B-EM', rozvrh },
  ],
};

beforeEach(() =>
  useAppStore.setState({
    language: 'cz',
    impersonationOptions: [{ faculty: 'PEF', programmes: [bf, eam] }],
    impersonationOptionsStatus: 'idle',
    impersonationGroups: { '1889': [1, 2] },
    impersonationStarting: false,
    impersonationError: null,
  })
);

describe('ImpersonationPicker', () => {
  it('asks for groups on picking a programme and starts with the full selection', () => {
    const start = vi.fn(async () => true);
    const loadGroups = vi.fn(async () => {});
    useAppStore.setState({ startImpersonation: start, loadImpersonationGroups: loadGroups });
    render(<ImpersonationPicker />);
    fireEvent.change(screen.getByLabelText('Fakulta'), { target: { value: 'PEF' } });
    fireEvent.change(screen.getByLabelText('Obor'), { target: { value: '1889' } });
    expect(loadGroups).toHaveBeenCalledWith(bf);
    fireEvent.change(screen.getByLabelText('Studijní skupina'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zobrazit' }));
    expect(start).toHaveBeenCalledWith({
      programId: '1889',
      shortCode: 'B-F',
      name: 'Finance',
      faculty: 'PEF',
      year: 1,
      group: 2,
      rozvrh,
      variants: [bfVariant],
    });
  });
  it('shows a programme with two IS versions once, by name only', () => {
    render(<ImpersonationPicker />);
    fireEvent.change(screen.getByLabelText('Fakulta'), { target: { value: 'PEF' } });
    const obor = screen.getByLabelText('Obor') as HTMLSelectElement;
    const labels = Array.from(obor.options).map((o) => o.text);
    expect(labels).toContain('Ekonomika a management');
    expect(labels).toContain('B-F Finance');
  });
  it('hides the group select from year 2', () => {
    render(<ImpersonationPicker />);
    fireEvent.change(screen.getByLabelText('Fakulta'), { target: { value: 'PEF' } });
    fireEvent.change(screen.getByLabelText('Obor'), { target: { value: '1889' } });
    fireEvent.change(screen.getByLabelText('Ročník'), { target: { value: '2' } });
    expect(screen.queryByLabelText('Studijní skupina')).toBeNull();
  });
  it('shows the error the last start produced', () => {
    useAppStore.setState({ impersonationError: 'noPlan' });
    render(<ImpersonationPicker />);
    expect(screen.getByText('Pro tento obor a ročník IS nemá studijní plán.')).toBeInTheDocument();
  });
});
