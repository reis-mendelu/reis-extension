import type { EduroamTarget } from '../../hooks/data/useEduroamSetup';

export type EduroamAction = 'qr' | 'download' | 'openSettings';

export interface StepMeta {
  /** Renders a live control in place of the screenshot placeholder. */
  action?: EduroamAction;
  /** Renders the real PasswordChip when a password is available. */
  password?: boolean;
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
  android: {
    doOnceUrl: 'https://play.google.com/store/apps/details?id=app.eduroam.geteduroam',
    steps: [{ action: 'qr' }, {}, { password: true }],
  },
  mac: {
    steps: [{ action: 'download' }, { action: 'openSettings' }, {}, { password: true }],
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
