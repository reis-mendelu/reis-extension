import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { QuestionForm } from './QuestionForm';
import { QuestionResultsCard } from './QuestionResultsCard';

/**
 * "Otázky" (reis_admin only, on both console layouts): write a question for
 * Novinky and read every question's results. The tab loads the list on open,
 * as Statistiky does.
 */
export function AdminQuestionsPanel() {
  const { t } = useTranslation();
  const list = useAppStore((s) => s.adminQuestions);
  const loading = useAppStore((s) => s.adminQuestionsLoading);
  const [writing, setWriting] = useState(false);

  return (
    <div data-testid="admin-questions" className="flex flex-col gap-3">
      {writing ? (
        <QuestionForm onDone={() => setWriting(false)} />
      ) : (
        <button type="button" className="btn btn-primary btn-sm self-start" onClick={() => setWriting(true)}>
          <Plus size={14} aria-hidden />
          {t('admin.questions.new')}
        </button>
      )}
      <p className="text-xs text-base-content/70">{t('admin.questions.devices')}</p>
      {list === null && !loading && (
        <p className="text-sm text-base-content/70">{t('admin.questions.loadError')}</p>
      )}
      {list?.length === 0 && <p className="text-sm text-base-content/70">{t('admin.questions.empty')}</p>}
      {list?.map((q) => <QuestionResultsCard key={q.id} q={q} />)}
    </div>
  );
}
