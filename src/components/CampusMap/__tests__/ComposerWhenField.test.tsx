import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComposerWhenField } from '../ComposerWhenField';

const t = (k: string) => k;
const noop = () => {};

const renderWhen = (date: string, endDate: string) =>
  render(
    <ComposerWhenField
      date={date}
      time=""
      endDate={endDate}
      onDate={noop}
      onTime={noop}
      onEndDate={noop}
      t={t}
      locale="cs-CZ"
    />
  );

// The end-before-start message appears without any focus change, so a screen
// reader hears it only if it is announced, and the end-date picker names it.
describe('ComposerWhenField: end before start', () => {
  it('announces the error and ties it to the end-date picker', () => {
    renderWhen('2026-11-20', '2026-11-18');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('map.endBeforeStart');
    const endTrigger = screen.getByRole('button', { name: /map\.endDate/ });
    expect(endTrigger).toHaveAttribute('aria-describedby', alert.id);
  });

  it('shows no error, and describes nothing, when the end is not before the start', () => {
    renderWhen('2026-11-18', '2026-11-20');
    expect(screen.queryByRole('alert')).toBeNull();
    const endTrigger = screen.getByRole('button', { name: /map\.endDate/ });
    expect(endTrigger).not.toHaveAttribute('aria-describedby');
  });
});
