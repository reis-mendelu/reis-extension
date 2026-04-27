import { ISKAM_BASE } from '../../api/iskam/client';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';
import type { PendingPayment } from '../../types/iskam';

interface Props {
    payments: PendingPayment[];
    language: IskamLanguage;
}

export function PendingPaymentsSection({ payments, language }: Props) {
    if (payments.length === 0) return null;

    const t = createIskamT(language);

    return (
        <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest px-1">
                {t('iskam.pendingPaymentsLabel')}
            </h3>
            <a
                href={`${ISKAM_BASE}/InformaceOKlientovi`}
                target="_blank"
                rel="noopener noreferrer"
                className="card bg-base-100 border border-warning/40 shadow-sm hover:border-warning/70 transition-colors"
            >
                <div className="card-body p-4 gap-0">
                    {payments.map((p, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-3 py-1.5 border-b border-base-200 last:border-0">
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm text-base-content truncate">{p.description}</span>
                                <span className="text-xs text-base-content/40">{t('iskam.pendingPaymentDue')} {p.dueDate}</span>
                            </div>
                            <span className="text-sm font-medium text-warning shrink-0">{p.amount}</span>
                        </div>
                    ))}
                </div>
            </a>
        </section>
    );
}
