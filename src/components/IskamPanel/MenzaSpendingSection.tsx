import { useState, useMemo } from 'react';
import type { KontaTransaction } from '../../types/iskam';
import { createIskamT, type IskamLanguage } from '../../i18n/iskamTranslate';

type Period = 'day' | 'week' | 'month';

function parseSettledDate(s: string): Date | null {
    const parts = s.split('.');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return date;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isInCurrentWeek(d: Date): boolean {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return d >= monday && d <= sunday;
}

function isInCurrentMonth(d: Date, today: Date): boolean {
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
}

function filterByPeriod(transactions: KontaTransaction[], period: Period): KontaTransaction[] {
    const today = new Date();
    return transactions.filter(tx => {
        if (tx.payment === null) return false;
        const d = parseSettledDate(tx.settledDate);
        if (!d) return false;
        if (period === 'day') return isSameDay(d, today);
        if (period === 'week') return isInCurrentWeek(d);
        return isInCurrentMonth(d, today);
    });
}

function groupByDate(transactions: KontaTransaction[]): [string, KontaTransaction[]][] {
    const map = new Map<string, KontaTransaction[]>();
    for (const tx of transactions) {
        const group = map.get(tx.settledDate) ?? [];
        group.push(tx);
        map.set(tx.settledDate, group);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
        const da = parseSettledDate(a);
        const db = parseSettledDate(b);
        if (!da || !db) return 0;
        return db.getTime() - da.getTime();
    });
}

function formatCzk(n: number): string {
    return n % 1 === 0 ? `${n} Kč` : `${n.toFixed(2).replace('.', ',')} Kč`;
}

interface DayGroupProps {
    date: string;
    transactions: KontaTransaction[];
}

function TransactionDayGroup({ date, transactions }: DayGroupProps) {
    const dayTotal = transactions.reduce((s, tx) => s + (tx.payment ?? 0), 0);
    return (
        <div>
            <div className="flex justify-between text-xs font-medium text-base-content/60 mb-1">
                <span>{date}</span>
                <span>{formatCzk(dayTotal)}</span>
            </div>
            {transactions.map(tx => (
                <div key={`${tx.datetime}-${tx.description}`} className="flex justify-between text-xs text-base-content/80 pl-3 py-0.5">
                    <span className="truncate pr-2">{tx.description}</span>
                    <span className="shrink-0 text-base-content/50">{tx.payment !== null ? formatCzk(tx.payment) : ''}</span>
                </div>
            ))}
        </div>
    );
}

interface Props {
    transactions: KontaTransaction[];
    language: IskamLanguage;
}

const COLLAPSED_GROUPS = 3;

export function MenzaSpendingSection({ transactions, language }: Props) {
    const [period, setPeriod] = useState<Period>('month');
    const [expanded, setExpanded] = useState(false);
    const t = createIskamT(language);

    const filtered = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);
    const total = useMemo(() => filtered.reduce((s, tx) => s + (tx.payment ?? 0), 0), [filtered]);
    const groups = useMemo(() => groupByDate(filtered), [filtered]);

    const monthStats = useMemo(() => {
        if (period !== 'month') return null;
        const visitDays = groups.length;
        return {
            visitDays,
            avgPerVisit: visitDays > 0 ? Math.round(total / visitDays) : 0,
        };
    }, [period, groups, total]);

    const periods: Period[] = ['day', 'week', 'month'];
    const periodLabels: Record<Period, string> = {
        day: t('iskam.spending.today'),
        week: t('iskam.spending.week'),
        month: t('iskam.spending.month'),
    };

    return (
        <section>
            <h3 className="text-xs font-semibold text-base-content/50 uppercase tracking-widest px-1 mb-2">
                {t('iskam.spending.title')}
            </h3>
            <div className="card bg-base-100 border border-base-200">
                <div className="card-body p-3 gap-3">
                    <div className="join w-full">
                        {periods.map(p => (
                            <button
                                key={p}
                                className={`btn btn-sm join-item flex-1 border-none ${period === p ? 'btn-primary' : 'btn-ghost'}`}
                                onClick={() => { setPeriod(p); setExpanded(false); }}
                            >
                                {periodLabels[p]}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-baseline justify-between">
                        <span className="text-xs text-base-content/50">{t('iskam.spending.total')}</span>
                        <span className="text-lg font-bold">{formatCzk(total)}</span>
                    </div>

                    {monthStats && (
                        <span className="text-xs text-base-content/40">
                            {t('iskam.spending.visits', { n: monthStats.visitDays })}
                            {monthStats.visitDays > 0 && <>{' · '}{t('iskam.spending.avgPerVisit', { amount: monthStats.avgPerVisit })}</>}
                        </span>
                    )}

                    {groups.length === 0 ? (
                        <p className="text-xs text-base-content/40 text-center py-2">–</p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2 mt-1">
                                {(expanded ? groups : groups.slice(0, COLLAPSED_GROUPS)).map(([date, txs]) => (
                                    <TransactionDayGroup key={date} date={date} transactions={txs} />
                                ))}
                            </div>
                            {groups.length > COLLAPSED_GROUPS && (
                                <button
                                    className="btn btn-xs btn-ghost w-full text-base-content/40"
                                    onClick={() => setExpanded(e => !e)}
                                >
                                    {expanded ? '↑' : `+${groups.length - COLLAPSED_GROUPS} ${t('iskam.spending.moreDays')}`}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </section>
    );
}
