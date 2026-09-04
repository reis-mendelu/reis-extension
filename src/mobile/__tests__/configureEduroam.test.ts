import { describe, it, expect, vi } from 'vitest';
import {
  configureEduroam,
  interpretAddResult,
  isEduroamConfigured,
  normalizeOutcome,
  RESULT_CANCELED,
  RESULT_OK,
  type ConfigureEduroamDeps,
} from '../configureEduroam';

function material(over: Partial<Parameters<typeof configureEduroam>[0]> = {}) {
  return {
    // 0x30 0x82 — the DER SEQUENCE header every real cert and .p12 starts with.
    clientP12: new Uint8Array([0x30, 0x82, 0x01, 0x02]),
    rootCaDer: new Uint8Array([0x30, 0x82, 0x03, 0x04]),
    password: 'hunter2',
    ...over,
  };
}

function deps(over: Partial<ConfigureEduroamDeps> = {}): ConfigureEduroamDeps {
  return {
    configure: vi.fn(async () => ({ resultCode: RESULT_OK, perNetwork: '0' })),
    ...over,
  };
}

describe('interpretAddResult', () => {
  it('reads per-network 0 as saved', () => {
    expect(interpretAddResult({ resultCode: RESULT_OK, perNetwork: '0' })).toBe('saved');
  });

  it('treats an existing eduroam network as success, not an error', () => {
    // ADD_WIFI_RESULT_ALREADY_EXISTS. A student re-running setup has the network
    // they wanted; saying "failed" would send them hunting for a problem.
    expect(interpretAddResult({ resultCode: RESULT_OK, perNetwork: '2' })).toBe(
      'already-configured'
    );
  });

  it('reads per-network 1 as a real failure', () => {
    expect(interpretAddResult({ resultCode: RESULT_OK, perNetwork: '1' })).toBe('failed');
  });

  it('reports a declined system dialog as cancelled, not failed', () => {
    // RESULT_CANCELED revokes nothing, so the student can simply be offered the
    // button again. Reporting an error here would be both wrong and scolding.
    expect(interpretAddResult({ resultCode: RESULT_CANCELED, perNetwork: '(none)' })).toBe(
      'cancelled'
    );
  });

  it('fails closed when Android returns OK but no per-network code', () => {
    // Guessing "saved" here would send the student to campus believing eduroam
    // works. The opposite mistake is self-correcting: a retry that actually
    // saved comes back ALREADY_EXISTS, which reads as success.
    expect(interpretAddResult({ resultCode: RESULT_OK, perNetwork: '(none)' })).toBe('failed');
  });

  it('fails closed on an unrecognised per-network code', () => {
    expect(interpretAddResult({ resultCode: RESULT_OK, perNetwork: '99' })).toBe('failed');
  });

  it('reads only the first code — one network is requested, so extras are noise', () => {
    expect(interpretAddResult({ resultCode: RESULT_OK, perNetwork: '0,1' })).toBe('saved');
  });
});

/**
 * "when I'm off the campus ... the iPad tries to join the network, but because
 * I'm not in the radius, it says unable to join. Even though we've configured
 * the network, and that was the goal."
 *
 * `NEHotspotConfigurationManager.apply` does two things at once: it SAVES the
 * configuration and it tries to ASSOCIATE. Out of range the association cannot
 * happen, so `apply` completes with an error and the plugin's `default:` branch
 * reported `failed` — while the configuration had in fact been installed. The
 * proof is the on-campus retry, which answers `already-configured`, and that
 * outcome is only returned after `getConfiguredSSIDs` confirms our SSID.
 *
 * So a student who sets eduroam up at home — the likeliest moment, right after
 * installing — was told setup had failed when it had worked.
 */
describe('normalizeOutcome', () => {
  // OUTCOMES is an allowlist and anything missing from it fails closed, so a
  // native outcome that is not registered here is silently downgraded to
  // `failed`. Worth remembering before adding one on the Swift side.
  it('fails closed on an outcome the plugin no longer sends', () => {
    expect(normalizeOutcome({ outcome: 'saved-not-joined' })).toBe('failed');
  });

  it.each(['saved', 'already-configured', 'cancelled', 'failed'] as const)(
    'passes the iOS outcome %s through',
    (outcome) => {
      expect(normalizeOutcome({ outcome })).toBe(outcome);
    }
  );

  it('decodes the Android shape through interpretAddResult', () => {
    expect(normalizeOutcome({ resultCode: RESULT_OK, perNetwork: '2' })).toBe('already-configured');
    expect(normalizeOutcome({ resultCode: RESULT_CANCELED, perNetwork: '(none)' })).toBe(
      'cancelled'
    );
  });

  it('fails closed on an outcome string neither platform defines', () => {
    // Guessing "saved" would send the student to campus believing eduroam
    // works. The opposite mistake is self-correcting: a retry that actually
    // saved comes back already-configured, which reads as success.
    expect(normalizeOutcome({ outcome: 'ok' })).toBe('failed');
    expect(normalizeOutcome({ outcome: '' })).toBe('failed');
  });

  it('fails closed when the plugin resolved with neither shape', () => {
    expect(normalizeOutcome({} as never)).toBe('failed');
    expect(normalizeOutcome(null)).toBe('failed');
    expect(normalizeOutcome(undefined)).toBe('failed');
  });

  it('ignores detail — it is a diagnostic, not a signal', () => {
    expect(
      normalizeOutcome({ outcome: 'cancelled', detail: 'NEHotspotConfigurationError 7' })
    ).toBe('cancelled');
  });
});

describe('configureEduroam', () => {
  it('returns the iOS outcome as-is when the plugin resolved the neutral shape', async () => {
    const d = deps({ configure: vi.fn(async () => ({ outcome: 'saved' })) });
    await expect(configureEduroam(material(), d)).resolves.toBe('saved');
  });

  it('hands the cert material across the bridge as base64', async () => {
    const d = deps();
    await configureEduroam(material(), d);
    expect(d.configure).toHaveBeenCalledWith({
      p12Base64: 'MIIBAg==',
      caDerBase64: 'MIIDBA==',
      passphrase: 'hunter2',
    });
  });

  it('returns the interpreted outcome rather than raw Android codes', async () => {
    const d = deps({ configure: vi.fn(async () => ({ resultCode: RESULT_OK, perNetwork: '2' })) });
    await expect(configureEduroam(material(), d)).resolves.toBe('already-configured');
  });

  it('refuses to call native code when IS gave us no extraction password', async () => {
    // The passphrase is what opens the PKCS#12. Without it the KeyStore load
    // fails inside the plugin, which surfaces as an opaque native stage error —
    // so catch it here, where the cause is still legible.
    const d = deps();
    await expect(configureEduroam(material({ password: null }), d)).rejects.toThrow(
      /extraction password/i
    );
    expect(d.configure).not.toHaveBeenCalled();
  });

  it('propagates a native rejection instead of reporting a phantom success', async () => {
    const d = deps({
      configure: vi.fn(async () => {
        throw new Error('FAILED at stage=keystore: IOException: wrong password');
      }),
    });
    await expect(configureEduroam(material(), d)).rejects.toThrow(/stage=keystore/);
  });
});

describe('stale-association (#261)', () => {
  /**
   * iOS answers `alreadyAssociated` (13) whenever the device is *currently on*
   * the SSID, whether or not a configuration backs it. Deleting the app removes
   * the configuration but leaves the association up, so a reinstall-and-retap on
   * campus lands there — and the old mapping reported it as success.
   */
  it('accepts the outcome instead of failing it closed', () => {
    expect(normalizeOutcome({ outcome: 'stale-association' })).toBe('stale-association');
  });

  it('is not a success: it must not read as already-configured', () => {
    expect(normalizeOutcome({ outcome: 'stale-association' })).not.toBe('already-configured');
    expect(normalizeOutcome({ outcome: 'stale-association' })).not.toBe('saved');
  });

  /**
   * The asymmetry is deliberate and worth pinning. Android's
   * ADD_WIFI_RESULT_ALREADY_EXISTS means a *saved network configuration* exists,
   * which is a real credential; iOS's alreadyAssociated only means "connected
   * right now". Android keeps reading as success.
   */
  it('leaves Android ALREADY_EXISTS reading as already-configured', () => {
    expect(interpretAddResult({ resultCode: RESULT_OK, perNetwork: '2' })).toBe(
      'already-configured'
    );
  });
});

/**
 * The three surfaces that ask "is eduroam set up?" each spelled the list out,
 * so a fourth success reached a `done` status no banner recognised and the card
 * said nothing at all. One predicate now, and this is what pins its edges.
 */
describe('isEduroamConfigured', () => {
  it.each(['saved', 'already-configured'] as const)(
    'counts %s as configured',
    (outcome) => {
      expect(isEduroamConfigured(outcome)).toBe(true);
    }
  );

  // #261: iOS answers alreadyAssociated whenever the device is ON the SSID,
  // configuration or not — nothing is installed on that path, and calling it
  // configured is the bug that sent students to campus believing it worked.
  it.each(['failed', 'cancelled', 'stale-association', null] as const)(
    'does not count %s',
    (outcome) => {
      expect(isEduroamConfigured(outcome)).toBe(false);
    }
  );
});
