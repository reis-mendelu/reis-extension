/**
 * Dev-only Google Drive test panel (Phase 0).
 *
 * Extension pages block DevTools console execution (CSP has no 'unsafe-eval'),
 * so we drive the OAuth/upload/refresh flow from on-screen buttons instead.
 * Shows the redirect URI to register in GCP, and logs each result inline.
 *
 * Self-gates: renders only under `wxt dev` or a `VITE_GOOGLE_DEV=true` build.
 */

import { useEffect, useState } from 'react';
import {
    connectGoogle,
    getAccessToken,
    getRedirectURL,
    identityDiag,
    disconnectGoogle,
    isConnected,
    expireAccessTokenForTest,
} from '@/api/googleAuth';
import { resetDriveBackup } from '@/services/drive/driveBackup';
import { loadManifest } from '@/services/drive/driveManifest';

const ENABLED = import.meta.env.DEV || import.meta.env.VITE_GOOGLE_DEV === 'true';

export function GoogleDevPanel() {
    const [open, setOpen] = useState(true);
    const [redirect, setRedirect] = useState('');
    const [connected, setConnected] = useState(false);
    const [busy, setBusy] = useState(false);
    const [log, setLog] = useState<string[]>([]);
    const [diag, setDiag] = useState('');
    const [manifestInfo, setManifestInfo] = useState('');
    const [armReset, setArmReset] = useState(false);

    const push = (msg: string) =>
        setLog((l) => [`${new Date().toLocaleTimeString()}  ${msg}`, ...l].slice(0, 8));

    const refreshManifest = async () => {
        try {
            const m = await loadManifest();
            const files = Object.keys(m.files).length;
            const folders = Object.keys(m.folders).length;
            const last = m.lastSync ? new Date(m.lastSync).toLocaleTimeString() : 'never';
            setManifestInfo(`manifest: ${files} files · ${folders} folders · last ${last}`);
        } catch {
            setManifestInfo('manifest: unavailable');
        }
    };

    useEffect(() => {
        (async () => {
            const topLevel = window.top === window.self;
            try {
                const d = await identityDiag();
                setDiag(
                    `bg-identity:${d.hasIdentity ? '✓' : '✗'}  bg-launch:${d.hasLaunch ? '✓' : '✗'}  ` +
                        `ctx:${topLevel ? 'top-level' : 'iframe'}`,
                );
                if (d.hasIdentity) {
                    try {
                        setRedirect(await getRedirectURL());
                    } catch (e) {
                        setRedirect(e instanceof Error ? e.message : String(e));
                    }
                } else {
                    setRedirect('chrome.identity not implemented by this browser (checked in background SW)');
                }
            } catch (e) {
                setDiag('background SW unreachable: ' + (e instanceof Error ? e.message : String(e)));
            }
            isConnected().then(setConnected).catch(() => {});
            refreshManifest();
        })();
    }, []);

    const run = (label: string, fn: () => Promise<unknown>) => async () => {
        setBusy(true);
        push(`▶ ${label}…`);
        try {
            const res = await fn();
            const detail =
                res && typeof res === 'object' ? JSON.stringify(res).slice(0, 140) : String(res ?? 'ok');
            push(`✔ ${label}: ${detail}`);
        } catch (e) {
            push(`✖ ${label}: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setConnected(await isConnected().catch(() => false));
            await refreshManifest();
            setBusy(false);
        }
    };

    const copyRedirect = async () => {
        try {
            await navigator.clipboard.writeText(redirect);
            push('✔ redirect URI copied');
        } catch {
            push('✖ copy blocked — select the field and Ctrl+C');
        }
    };

    if (!ENABLED) return null;

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="btn btn-xs btn-primary fixed bottom-2 right-2 z-[9999]"
            >
                Google ▲
            </button>
        );
    }

    return (
        <div className="card bg-base-100 shadow-xl border border-base-300 fixed bottom-2 right-2 z-[9999] w-80">
            <div className="card-body p-3 gap-2">
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Google Drive · dev</span>
                    <span className={`badge badge-sm ${connected ? 'badge-success' : 'badge-ghost'}`}>
                        {connected ? 'connected' : 'not connected'}
                    </span>
                </div>

                <span className="text-[10px] font-mono opacity-60">{diag}</span>
                <span className="text-[10px] font-mono opacity-60">{manifestInfo}</span>

                <span className="text-xs opacity-70">Redirect URI — register this in the GCP Web client</span>
                <div className="join w-full">
                    <input
                        readOnly
                        value={redirect}
                        onFocus={(e) => e.currentTarget.select()}
                        className="input input-bordered input-xs join-item flex-1 font-mono text-[10px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <button onClick={copyRedirect} className="btn btn-xs join-item">
                        Copy
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-1">
                    <button
                        disabled={busy}
                        onClick={run('connect', connectGoogle)}
                        className="btn btn-xs btn-primary"
                    >
                        Connect
                    </button>
                    <button
                        disabled={busy || !connected}
                        onClick={() => {
                            if (!armReset) {
                                setArmReset(true);
                                push('⚠ click again to delete the whole reIS folder + manifest');
                                return;
                            }
                            setArmReset(false);
                            run('reset backup', resetDriveBackup)();
                        }}
                        className={`btn btn-xs ${armReset ? 'btn-error' : 'btn-warning'}`}
                    >
                        {armReset ? 'Confirm reset' : 'Reset backup'}
                    </button>
                    <button
                        disabled={busy}
                        onClick={run('force refresh', async () => {
                            await expireAccessTokenForTest();
                            return getAccessToken();
                        })}
                        className="btn btn-xs"
                    >
                        Force refresh
                    </button>
                    <button
                        disabled={busy}
                        onClick={run('disconnect', disconnectGoogle)}
                        className="btn btn-xs btn-ghost"
                    >
                        Disconnect
                    </button>
                </div>

                <pre className="bg-base-200 rounded p-1 text-[10px] leading-relaxed max-h-28 overflow-auto whitespace-pre-wrap break-words m-0">
                    {log.length ? log.join('\n') : 'ready'}
                </pre>

                <button onClick={() => setOpen(false)} className="btn btn-ghost btn-xs self-end">
                    ▼ hide
                </button>
            </div>
        </div>
    );
}
