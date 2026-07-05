import { describe, it, expect, vi } from 'vitest';
import { logError } from '../../utils/reportError';
import { societyById } from '../societies';

vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

describe('societyById', () => {
  it('resolves the reIS team association (reis_admin) without an ESN fallback or error', () => {
    const soc = societyById('reis');
    expect(soc.id).toBe('reis');
    expect(soc.name).toBe('reIS');
    expect(logError).not.toHaveBeenCalled();
  });

  it('returns a known society directly', () => {
    expect(societyById('supef').shortName).toBe('SUPEF');
  });

  it('falls back to ESN and logs for a genuinely unknown id', () => {
    expect(societyById('definitely-not-a-society').id).toBe('esn');
    expect(logError).toHaveBeenCalled();
  });
});
