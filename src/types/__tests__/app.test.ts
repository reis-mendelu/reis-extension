import { describe, it, expect } from 'vitest';
import { APP_VIEWS, isAppView } from '../app';

describe('isAppView', () => {
  it.each(APP_VIEWS)('accepts the live view %s', (v) => {
    expect(isAppView(v)).toBe(true);
  });

  // The reason this guard exists. 'iskam-dashboard' was a real AppView until
  // the WebISKAM integration was removed; a value persisted under an older
  // build must not survive hydration and strand the app on a view nothing
  // renders. The same applies to any view removed after this one.
  it('rejects a view removed in a previous build', () => {
    expect(isAppView('iskam-dashboard')).toBe(false);
  });

  it.each([undefined, null, '', 'nonsense', 42, {}, ['calendar']])('rejects %s', (v) => {
    expect(isAppView(v)).toBe(false);
  });
});
