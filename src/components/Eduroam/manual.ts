import type { EduroamTarget } from '../../hooks/data/useEduroamSetup';

export type EduroamAction = 'qr' | 'download' | 'openSettings';

export interface StepMeta {
  /** Renders a live control in place of the screenshot placeholder. */
  action?: EduroamAction;
  /** Renders the real PasswordChip when a password is available. */
  password?: boolean;
  /** Renders the manual Wi-Fi field-values block (Android manual EAP-TLS setup). */
  fields?: boolean;
  /** Public path to a screenshot shown under the step (only where we have one). */
  img?: string;
}

export interface DeviceManual {
  /** geteduroam install link for the "do once" block (android/windows only). */
  doOnceUrl?: string;
  steps: StepMeta[];
}

/** Step structure per device. Copy lives in i18n under eduroam.manual.<target>.* */
export const EDUROAM_MANUAL: Record<EduroamTarget, DeviceManual> = {
  ios: {
    steps: [{ action: 'qr' }, {}, {}, { password: true }],
  },
  // Manual EAP-TLS path (no geteduroam): deliver the .p12, install it, then add
  // the eduroam network by hand. Reliable at MENDELU (geteduroam isn't in eduroam
  // discovery) and yields a normal saved network that lasts the cert's full year.
  android: {
    steps: [
      { action: 'qr' },
      { password: true },
      { fields: true },
    ],
  },
  mac: {
    steps: [
      { action: 'download', img: '/eduroam/mac/1.webp' },
      { action: 'openSettings', img: '/eduroam/mac/2.webp' },
      { img: '/eduroam/mac/3.webp' },
      { password: true, img: '/eduroam/mac/4.webp' },
    ],
  },
  windows: {
    doOnceUrl: 'https://www.geteduroam.app/',
    steps: [{ action: 'download' }, {}, { password: true }],
  },
};

/** Build a dotted i18n key under eduroam.manual.<target>. */
export function manualKey(target: EduroamTarget, ...parts: (string | number)[]): string {
  return ['eduroam', 'manual', target, ...parts].join('.');
}
