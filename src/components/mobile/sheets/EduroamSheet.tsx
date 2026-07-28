import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { PasswordChip } from '../../Eduroam/PasswordChip';
import { useEduroamSetup, type EduroamTarget } from '../../../hooks/data/useEduroamSetup';
import { useTranslation } from '../../../hooks/useTranslation';
import { isMac, isMobile } from '../../../utils/platform';

export interface EduroamSheetProps {
    onClose: () => void;
}

/** Which eduroam profile to hand the student, guessed from this browser —
 *  there's no device picker here (unlike the desktop drawer): the phone
 *  running this sheet *is* the device being set up. */
function detectTarget(): EduroamTarget {
    if (isMobile()) return isMac() ? 'ios' : 'android';
    return isMac() ? 'mac' : 'windows';
}

function NumberBadge({ n }: { n: number }) {
    return (
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">
            {n}
        </span>
    );
}

/**
 * Container sheet for the eduroam flow (prototype lines 535-544): three
 * numbered rows — certificate password, one-tap download for the detected
 * device, and the install/connect hint. All certificate/profile generation
 * logic stays in `useEduroamSetup` (shared with the desktop `EduroamDrawer`)
 * — this sheet only auto-picks the target and lays out the result.
 */
export function EduroamSheet({ onClose }: EduroamSheetProps) {
    const { t } = useTranslation();
    const target = detectTarget();
    const { status, password, qrDataUrl, error, run } = useEduroamSetup(target);
    const working = status === 'working';

    return (
        <Sheet size="content" onClose={onClose}>
            <SheetHeader title={t('eduroam.heroTitle')} subtitle={t('eduroam.subtitle')} onClose={onClose} />
            <div className="flex flex-col gap-3.5 px-4 pb-6">
                {status === 'error' && (
                    <div className="alert alert-error text-base">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>{t('eduroam.error')}{error ? `: ${error}` : ''}</span>
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <NumberBadge n={1} />
                    <div className="min-w-0 flex-1">
                        {password ? (
                            <PasswordChip password={password} />
                        ) : (
                            <span className="text-base text-base-content/60">{t('eduroam.pwdLabel')}</span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <NumberBadge n={2} />
                    <button
                        type="button"
                        onClick={() => run(target)}
                        disabled={working}
                        className="btn btn-primary flex-1 gap-2"
                    >
                        {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {working ? t('eduroam.preparing') : t('eduroam.download')}
                    </button>
                </div>

                {status === 'done' && qrDataUrl && (
                    <div className="ml-9 self-start rounded-box bg-white p-3">
                        <img src={qrDataUrl} alt="eduroam QR" width={160} height={160} />
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <NumberBadge n={3} />
                    <span className="flex-1 text-sm text-base-content/70">{t('eduroam.connectStep')}</span>
                </div>
            </div>
        </Sheet>
    );
}
