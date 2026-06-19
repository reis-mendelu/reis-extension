import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../hooks/data/useEduroamSetup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/data/useEduroamSetup')>()),
  isWindows: true,
}));

import { WindowsInstall } from '../WindowsInstall';

afterEach(() => cleanup());

function en() {
  useAppStore.setState({ language: 'en' });
}

describe('WindowsInstall on a Windows machine', () => {
  it('shows the geteduroam link and an enabled download button', () => {
    en();
    render(
      <WindowsInstall status="idle" password={null} guideHref="https://eduroam.mendelu.cz/" onDownload={() => {}} />,
    );
    expect(screen.getByText(/geteduroam/i)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /Download eduroam profile/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows the stepper with the .eap-config filename and the password chip when done', () => {
    en();
    render(
      <WindowsInstall status="done" password="pw123" guideHref="https://eduroam.mendelu.cz/" onDownload={() => {}} />,
    );
    expect(screen.getByText(/eduroam-reis\.eap-config/i)).toBeTruthy();
    expect(screen.getByText('pw123')).toBeTruthy();
  });
});
