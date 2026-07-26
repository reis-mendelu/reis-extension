import { useAppStore } from '../src/store/useAppStore';

// Dev-only phone override: `?mobile=1` forces the phone branch, `?mobile=0`
// forces desktop. Guarded by import.meta.env.DEV so it cannot ship. Needed
// because `pointer: coarse` requires touch emulation, which plain browser
// resizing does not provide.
if (import.meta.env.DEV) {
    const param = new URLSearchParams(window.location.search).get('mobile');
    if (param === '1') useAppStore.getState().setDevPhoneOverride(true);
    if (param === '0') useAppStore.getState().setDevPhoneOverride(false);
}
