import type { EduroamTarget } from '../../hooks/data/useEduroamSetup';

export type EduroamAction = 'qr' | 'download' | 'openSettings';

export interface StepMeta {
  /** Renders a live control in place of the screenshot placeholder. */
  action?: EduroamAction;
  /** Renders the real PasswordChip when a password is available. */
  password?: boolean;
  /** Public path to a screenshot shown under the step (only where we have one). */
  img?: string;
}

export interface DeviceManual {
  /** geteduroam install link for the "do once" block (android/windows only). */
  doOnceUrl?: string;
  steps: StepMeta[];
}

/** Step structure per device. Copy lives in i18n under eduroam.manual.<target>.* */
/** The devices the desktop drawer sets up: the machine reIS is running on.
 *  Phones are configured by the reIS app itself, natively, so the browser no
 *  longer offers them — that path was a desktop→phone QR transfer. */
export type DesktopEduroamTarget = Extract<EduroamTarget, 'mac' | 'windows'>;

export const EDUROAM_MANUAL: Record<DesktopEduroamTarget, DeviceManual> = {
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
    // The geteduroam wizard, screen by screen. Double-clicking the
    // .eap-config does not open it — Windows has no association for the
    // extension — so the file is loaded from the app's ··· menu, and the
    // certificate must be installed before Next is even enabled.
    steps: [
      { action: 'download' },
      { img: '/eduroam/windows/1.webp' },
      { img: '/eduroam/windows/2.webp' },
      { img: '/eduroam/windows/3.webp' },
      { img: '/eduroam/windows/4.webp' },
      { password: true, img: '/eduroam/windows/5.webp' },
    ],
  },
};

/** Build a dotted i18n key under eduroam.manual.<target>. */
export function manualKey(target: EduroamTarget, ...parts: (string | number)[]): string {
  return ['eduroam', 'manual', target, ...parts].join('.');
}
