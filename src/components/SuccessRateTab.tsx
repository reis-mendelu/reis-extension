import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useSuccessRate } from '../hooks/data/useSuccessRate';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';
import type { SimilarSuggestion } from '../types/schemas/similarSubjects.schema';
import { SuccessRateView } from './SuccessRate/SuccessRateView';
import { SimilarSubjectsList } from './SuccessRate/SimilarSubjectsList';
import { PreviewBanner } from './SuccessRate/PreviewBanner';

const Spinner = () => (
  <div className="flex items-center justify-center h-full">
    <span className="loading loading-spinner text-primary" />
  </div>
);

/**
 * Úspěšnost, on both trees (DrawerTabBody mounts it for the extension drawer
 * and the phone sheet). Three states: the subject's own stats; no stats, with
 * or without similar subjects to offer; and a preview of one of them.
 */
export function SuccessRateTab({
  courseCode,
  facultyCode,
  showIsBacklink = true,
}: {
  courseCode: string;
  facultyCode?: string;
  /** Off for the phone sheet — see `showIsBacklink` in DrawerTabBody. */
  showIsBacklink?: boolean;
}) {
  const { stats: data, loading } = useSuccessRate(courseCode);
  const suggestions = useAppStore((s) => s.similarSubjects[courseCode]);
  // Which subject the preview was opened FOR: the desktop drawer reuses this
  // component across subjects, and two new subjects can offer the same old one.
  const [preview, setPreview] = useState<{ course: string; code: string } | null>(null);
  const previewCode = preview?.course === courseCode ? preview.code : null;

  if (loading) return <Spinner />;
  if (data?.stats?.length)
    return (
      <SuccessRateView
        semesters={data.stats}
        facultyCode={facultyCode}
        showIsBacklink={showIsBacklink}
      />
    );

  const picked = suggestions?.find((s) => s.code === previewCode);
  if (picked)
    return (
      <SimilarPreview
        suggestion={picked}
        facultyCode={facultyCode}
        showIsBacklink={showIsBacklink}
        onBack={() => setPreview(null)}
      />
    );

  // No entry yet: the lookup has not answered. The empty state would read as
  // final and the list would pop in under it. The slices always settle it.
  if (suggestions === undefined) return <Spinner />;

  const hasSuggestions = suggestions.length > 0;
  return (
    <div
      className={`flex h-full flex-col overflow-y-auto pb-4 ${hasSuggestions ? 'gap-5 pt-6' : 'gap-8 pt-12'}`}
    >
      <NoResults hasSuggestions={hasSuggestions} />
      {hasSuggestions && (
        <SimilarSubjectsList
          suggestions={suggestions}
          onPick={(code) => setPreview({ course: courseCode, code })}
        />
      )}
    </div>
  );
}

/** The empty state reIS uses elsewhere ("Zatím žádné předměty"). The icon only
 * when there is nothing below it; with suggestions, the list is the content. */
function NoResults({ hasSuggestions }: { hasSuggestions: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 px-6 text-center">
      {!hasSuggestions && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BarChart3 size={28} />
        </div>
      )}
      <div className="font-display text-lg font-bold">{t('successRate.noResultsTitle')}</div>
      <div className="max-w-60 text-xs text-base-content/60">
        {t(hasSuggestions ? 'successRate.noResultsSimilar' : 'successRate.noResultsBody')}
      </div>
    </div>
  );
}

function SimilarPreview({
  suggestion,
  facultyCode,
  showIsBacklink,
  onBack,
}: {
  suggestion: SimilarSuggestion;
  facultyCode?: string;
  showIsBacklink: boolean;
  onBack: () => void;
}) {
  // Loads under the OLD code, where these stats belong; the new code's entry
  // stays empty, so list badges and insights never show borrowed numbers.
  const { stats, loading } = useSuccessRate(suggestion.code);
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full">
      <PreviewBanner suggestion={suggestion} onBack={onBack} />
      <div className="flex-1 min-h-0">
        {loading ? (
          <Spinner />
        ) : stats?.stats?.length ? (
          <SuccessRateView
            semesters={stats.stats}
            facultyCode={facultyCode}
            showIsBacklink={showIsBacklink}
          />
        ) : (
          <p className="text-sm text-base-content/70 text-center pt-16">
            {t('successRate.noData')}
          </p>
        )}
      </div>
    </div>
  );
}
