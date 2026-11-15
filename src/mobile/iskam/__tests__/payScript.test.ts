import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildPayScript } from '../payScript';

const ID = '00000000-0000-0000-0000-000000000001';
const fixture = readFileSync(resolve(__dirname, 'fixtures/pohledavky.html'), 'utf8');

/** Runs the script with a fake location/sessionStorage, against the fixture's DOM. */
function run(path: string, store: Map<string, string> | null, host = 'webiskam.mendelu.cz') {
  const loc = { hostname: host, pathname: path, href: '' };
  const storage = store
    ? {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      }
    : {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('blocked');
        },
      };
  const hide = vi.fn();
  const jq = vi.fn(() => ({ modal: hide }));
  const close = vi.fn();
  const win = { jQuery: jq, mobileApp: { close } };
  new Function('location', 'sessionStorage', 'window', buildPayScript(ID, 'n1'))(loc, storage, win);
  return { loc, hide, close };
}

describe('buildPayScript', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.innerHTML = new DOMParser().parseFromString(
      fixture,
      'text/html'
    ).documentElement.innerHTML;
  });
  afterEach(() => vi.useRealTimers());

  it('presses the claim’s € button on the claims page, and nothing else', () => {
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
    const { loc, hide } = run('/InformaceOKlientovi', new Map());
    vi.advanceTimersByTime(600);
    expect(opened).toHaveBeenCalledOnce();
    expect(paid).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
    expect(loc.href).toBe('');
  });

  it('closes the dialog again when it did not take this claim’s id', () => {
    const { hide } = run('/InformaceOKlientovi', new Map());
    vi.advanceTimersByTime(600);
    expect(hide).toHaveBeenCalledWith('hide');
  });

  it('after a lapsed session: sign-in, then the claims page, then never again', () => {
    const store = new Map<string, string>();
    expect(run('/Home/Index', store).loc.href).toBe('/Prihlaseni/AuthShibb');
    expect(run('/Prihlaseni/AuthShibb', store).loc.href).toBe('');
    expect(run('/Home/Index', store).loc.href).toBe('/InformaceOKlientovi');
    expect(run('/Home/Index', store).loc.href).toBe('');
  });

  it('stays wherever WebISKAM goes once the claims page was reached (after paying)', () => {
    const store = new Map<string, string>();
    run('/InformaceOKlientovi', store);
    expect(run('/Konta', store).loc.href).toBe('');
  });

  it('does not navigate when sessionStorage is unavailable (no loop)', () => {
    expect(run('/Home/Index', null).loc.href).toBe('');
  });

  it('does nothing on the MENDELU sign-in page', () => {
    expect(run('/idp/profile', new Map(), 'alibaba.mendelu.cz').loc.href).toBe('');
  });

  it('refuses anything but a GUID as the id', () => {
    expect(() => buildPayScript("x'];alert(1)//", 'n1')).toThrow();
    expect(() => buildPayScript(ID, 'a b')).toThrow();
  });

  it('closes the view when the claims page comes back without the opened claim (paid)', () => {
    const store = new Map<string, string>();
    run('/InformaceOKlientovi', store);
    document.querySelector('#omezeniPohledavkyTable')!.closest('.panel')!.remove();
    const { close, loc } = run('/InformaceOKlientovi', store);
    vi.advanceTimersByTime(700);
    expect(close).toHaveBeenCalledOnce();
    expect(loc.href).toBe('');
  });

  it('does not close a view that never opened the claim', () => {
    document.querySelector('#omezeniPohledavkyTable')!.closest('.panel')!.remove();
    const { close } = run('/InformaceOKlientovi', new Map());
    vi.advanceTimersByTime(700);
    expect(close).not.toHaveBeenCalled();
  });
});
