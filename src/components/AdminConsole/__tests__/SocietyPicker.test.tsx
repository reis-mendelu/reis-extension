import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { BUNDLED_SOCIETIES } from '../../../data/societies';
import { SocietyPicker } from '../SocietyPicker';

const picker = () => screen.getByRole('combobox') as HTMLSelectElement;

describe('SocietyPicker', () => {
  beforeEach(() =>
    useAppStore.setState({
      language: 'cz',
      societies: BUNDLED_SOCIETIES,
      adminActiveAssociationId: 'zf',
    } as never)
  );

  it('offers active societies only', () => {
    useAppStore.setState({
      societies: { ...BUNDLED_SOCIETIES, esn: { ...BUNDLED_SOCIETIES.esn!, isActive: false } },
    });
    render(<SocietyPicker />);
    expect(picker().value).toBe('zf');
    expect(screen.queryByRole('option', { name: BUNDLED_SOCIETIES.esn!.name })).toBeNull();
  });

  // Hiding the society being authored used to drop its option: the select then
  // showed another society while authoring still targeted the hidden one.
  it('keeps the society being authored when it is hidden, and says so', () => {
    useAppStore.setState({
      societies: { ...BUNDLED_SOCIETIES, zf: { ...BUNDLED_SOCIETIES.zf!, isActive: false } },
    });
    render(<SocietyPicker />);
    expect(picker().value).toBe('zf');
    expect(picker().selectedOptions[0]!.textContent).toBe(`${BUNDLED_SOCIETIES.zf!.name} · Skrytý`);
  });
});
