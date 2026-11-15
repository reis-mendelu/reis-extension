import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  INITIAL_PAY_STATE,
  asProbe,
  buildOpenDialogScript,
  buildProbeScript,
  nextPayStep,
  type PayProbe,
  type PayState,
} from '../payScript';

const ID = '00000000-0000-0000-0000-000000000001';
const fixture = readFileSync(resolve(__dirname, 'fixtures/pohledavky.html'), 'utf8');

/** Runs an injected script with a fake location/window, against the current DOM. */
function run(code: string, host = 'webiskam.mendelu.cz', path = '/InformaceOKlientovi') {
  const hide = vi.fn();
  const postMessage = vi.fn();
  const win = { jQuery: vi.fn(() => ({ modal: hide })), mobileApp: { postMessage } };
  new Function('location', 'window', code)({ hostname: host, pathname: path }, win);
  return { hide, postMessage };
}

describe('the injected scripts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.innerHTML = new DOMParser().parseFromString(
      fixture,
      'text/html'
    ).documentElement.innerHTML;
  });
  afterEach(() => vi.useRealTimers());

  it('open: presses the claim’s € button, and never the pay button', () => {
    const opener = document.querySelector<HTMLButtonElement>('.payfrommainaccount')!;
    const pay = document.querySelector<HTMLInputElement>('#ZaplatitZKonta input[type=submit]')!;
    const form = document.querySelector('#ZaplatitZKonta form') as HTMLFormElement;
    const opened = vi.fn();
    const paid = vi.fn();
    opener.addEventListener('click', () => {
      opened();
      (document.getElementById('IDPolozky') as HTMLInputElement).value = ID;
    });
    pay.addEventListener('click', paid);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      paid();
    });
    const { hide } = run(buildOpenDialogScript(ID));
    vi.advanceTimersByTime(600);
    expect(opened).toHaveBeenCalledOnce();
    expect(paid).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
  });

  it('open: closes the dialog again when it did not take this claim’s id', () => {
    const { hide } = run(buildOpenDialogScript(ID));
    vi.advanceTimersByTime(600);
    expect(hide).toHaveBeenCalledWith('hide');
  });

  it('open: does nothing on another host or without the claim', () => {
    const clicked = vi.fn();
    document.querySelector('.payfrommainaccount')!.addEventListener('click', clicked);
    run(buildOpenDialogScript(ID), 'alibaba.mendelu.cz');
    run(buildOpenDialogScript('00000000-0000-0000-0000-000000000002'));
    expect(clicked).not.toHaveBeenCalled();
  });

  it('probe: reports where the page is and whether the claim is on it', () => {
    const { postMessage } = run(buildProbeScript(ID));
    expect(postMessage).toHaveBeenCalledWith({
      reisClaimProbe: true,
      path: '/InformaceOKlientovi',
      hasClaim: true,
      claimsPage: true,
    });
  });

  it('probe: silent on the MENDELU sign-in', () => {
    expect(run(buildProbeScript(ID), 'alibaba.mendelu.cz').postMessage).not.toHaveBeenCalled();
  });

  it('refuses anything but a GUID as the id', () => {
    expect(() => buildOpenDialogScript("x'];alert(1)//")).toThrow();
    expect(() => buildProbeScript('nope')).toThrow();
  });
});

const page = (path: string, hasClaim = false, claimsPage = false): PayProbe => ({
  path,
  hasClaim,
  claimsPage,
});
function walk(...probes: PayProbe[]): { actions: string[]; state: PayState } {
  let state = INITIAL_PAY_STATE;
  const actions: string[] = [];
  for (const p of probes) {
    const step = nextPayStep(state, p);
    state = step.state;
    actions.push(step.action);
  }
  return { actions, state };
}

describe('nextPayStep', () => {
  it('claims page with the claim: nothing to do (the open script opened it)', () => {
    expect(walk(page('/InformaceOKlientovi', true, true)).actions).toEqual(['none']);
  });

  it('after paying (claim gone from the signed-in claims page): close, once', () => {
    const { actions } = walk(
      page('/InformaceOKlientovi', true, true),
      page('/InformaceOKlientovi', false, true),
      page('/InformaceOKlientovi', false, true)
    );
    expect(actions).toEqual(['none', 'close', 'none']);
  });

  it('never closes a view that never had the claim', () => {
    expect(walk(page('/InformaceOKlientovi', false, true)).actions).toEqual(['none']);
  });

  it('a lapsed session: sign-in, then the claims page, then never again', () => {
    expect(
      walk(
        page('/Home/Index'),
        page('/Prihlaseni/AuthShibb'),
        page('/ObjednavkyStravovani'),
        page('/Home/Index')
      ).actions
    ).toEqual(['auth', 'none', 'claims', 'none']);
  });

  it('stays wherever WebISKAM goes once the claims page was reached', () => {
    expect(walk(page('/InformaceOKlientovi', true, true), page('/Konta')).actions).toEqual([
      'none',
      'none',
    ]);
  });

  it('accepts only the probe’s exact shape from the bridge', () => {
    expect(asProbe({ reisClaimProbe: true, path: '/x', hasClaim: true })).toEqual({
      path: '/x',
      hasClaim: true,
      claimsPage: false,
    });
    expect(asProbe({ path: '/x' })).toBeNull();
    expect(asProbe({ reisClaimProbe: 'yes', path: '/x' })).toBeNull();
    expect(asProbe(null)).toBeNull();
  });
});
