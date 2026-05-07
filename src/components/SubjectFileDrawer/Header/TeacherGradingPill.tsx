import { useState, useEffect } from 'react';
import { supabase } from '../../../services/spolky/supabaseClient';
import { ChromeAsyncStorage } from '../../../services/storage/ChromeAsyncStorage';
import { useTranslation } from '../../../hooks/useTranslation';

type GradingValue = 'strict' | 'fair' | 'generous';

interface Counts { strict: number; fair: number; generous: number }

// Dot color — semantic signal, not decorative
const DOT: Record<GradingValue, string> = {
    strict: 'bg-error',
    fair: 'bg-warning',
    generous: 'bg-success',
};

// Hover color for expanded options
const HOVER: Record<GradingValue, string> = {
    strict: 'hover:text-error',
    fair: 'hover:text-warning',
    generous: 'hover:text-success',
};

// Active color for expanded options (already voted)
const ACTIVE: Record<GradingValue, string> = {
    strict: 'text-error',
    fair: 'text-warning',
    generous: 'text-success',
};

const SESSION_KEY = 'reis_session_id';

const LABEL_KEY: Record<GradingValue, string> = {
    strict: 'course.teacherRating.strict',
    fair: 'course.teacherRating.fair',
    generous: 'course.teacherRating.generous',
};

function getWinners(counts: Counts): GradingValue[] {
    const max = Math.max(counts.strict, counts.fair, counts.generous);
    if (max === 0) return [];
    return (['strict', 'fair', 'generous'] as GradingValue[]).filter(k => counts[k] === max);
}

async function getOrCreateSessionId(): Promise<string> {
    const existing = await ChromeAsyncStorage.get<string>(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    await ChromeAsyncStorage.set(SESSION_KEY, id);
    return id;
}

export function TeacherGradingPill({ teacherId }: { teacherId: string }) {
    const { t } = useTranslation();
    const [counts, setCounts] = useState<Counts>({ strict: 0, fair: 0, generous: 0 });
    const [voted, setVoted] = useState<GradingValue | null>(null);
    const [open, setOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');

    useEffect(() => {
        let cancelled = false;
        async function init() {
            const sid = await getOrCreateSessionId();
            const existingVote = await ChromeAsyncStorage.get<GradingValue>(`grading_${teacherId}`);
            if (cancelled) return;
            setSessionId(sid);
            if (existingVote) setVoted(existingVote);

            const { data } = await supabase.rpc('get_subject_rating_counts', { p_teacher_id: teacherId });
            if (cancelled || !data) return;
            setCounts({ strict: data.strict ?? 0, fair: data.fair ?? 0, generous: data.generous ?? 0 });
        }
        init();
        return () => { cancelled = true; };
    }, [teacherId]);

    const total = counts.strict + counts.fair + counts.generous;
    const winners = total >= 3 ? getWinners(counts) : [];

    async function remove() {
        if (!sessionId || !voted) return;
        await supabase.rpc('delete_subject_rating', { p_teacher_id: teacherId, p_session_id: sessionId });
        await ChromeAsyncStorage.remove(`grading_${teacherId}`);
        setCounts(prev => ({ ...prev, [voted]: Math.max(0, prev[voted] - 1) }));
        setVoted(null);
        setOpen(false);
    }

    async function vote(value: GradingValue) {
        if (!sessionId) return;
        await supabase.rpc('upsert_subject_rating', {
            p_teacher_id: teacherId,
            p_session_id: sessionId,
            p_tag_value: value,
        });
        await ChromeAsyncStorage.set(`grading_${teacherId}`, value);
        setCounts(prev => {
            const next = { ...prev };
            if (voted) next[voted] = Math.max(0, next[voted] - 1);
            next[value]++;
            return next;
        });
        setVoted(value);
        setOpen(false);
    }

    // Expanded: three plain text options, current vote in accent color with × to remove
    if (open) {
        return (
            <span className="inline-flex items-center gap-2">
                {(['strict', 'fair', 'generous'] as GradingValue[]).map(v => (
                    <button
                        key={v}
                        onClick={() => vote(v)}
                        className={`text-[10px] font-semibold transition-colors ${
                            voted === v ? ACTIVE[v] : `text-base-content/40 ${HOVER[v]}`
                        }`}
                    >
                        {t(LABEL_KEY[v])}
                    </button>
                ))}
                <button
                    onClick={voted ? remove : () => setOpen(false)}
                    className={`text-[10px] transition-colors leading-none ${
                        voted
                            ? 'text-base-content/30 hover:text-error'
                            : 'text-base-content/20 hover:text-base-content/50'
                    }`}
                >
                    ✕
                </button>
            </span>
        );
    }

    // Collapsed with community consensus: dot + label + muted count
    if (winners.length > 0) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 group"
            >
                <span className={`w-1.5 h-1.5 rounded-full ${DOT[winners[0]]} shrink-0 opacity-70 group-hover:opacity-100 transition-opacity`} />
                <span className="text-[10px] font-semibold italic text-base-content/45 group-hover:text-base-content/65 transition-colors">
                    {winners.map(w => t(LABEL_KEY[w])).join(' · ')}
                </span>
                <span className="text-[10px] text-base-content/20 group-hover:text-base-content/35 transition-colors">{total}</span>
            </button>
        );
    }

    // Unvoted / below threshold: near-invisible ghost prompt
    return (
        <button
            onClick={() => setOpen(true)}
            className="text-[10px] font-semibold italic text-base-content/20 hover:text-base-content/45 transition-colors"
        >
            {voted ? (
                <span className="inline-flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${DOT[voted]} shrink-0 opacity-40`} />
                    <span>{t(LABEL_KEY[voted])}</span>
                </span>
            ) : t('course.teacherRating.rate')}
        </button>
    );
}
