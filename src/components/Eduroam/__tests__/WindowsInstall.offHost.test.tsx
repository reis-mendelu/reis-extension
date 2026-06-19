import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';

vi.mock('../../../hooks/data/useEduroamSetup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../hooks/data/useEduroamSetup')>()),
  isWindows: false,
}));

import { WindowsInstall } from '../WindowsInstall';

afterEach(() => cleanup());

describe('WindowsInstall off a Windows machine', () => {
  it('disables the download button and shows the cross-host hint', () => {
    useAppStore.setState({ language: 'en' });
    render(
      <WindowsInstall status="idle" password={null} guideHref="https://eduroam.mendelu.cz/" onDownload={() => {}} />,
    );
    const btn = screen.getByRole('button', { name: /Download eduroam profile/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/not on Windows/i)).toBeTruthy();
  });
});
