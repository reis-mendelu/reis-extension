import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { ALL_FACULTY_KEYS } from '../../types/events';
import type { QuestionButton } from '../../types/questions';
import { PRESETS, draftError, draftToInput, newDraft, type QuestionDraft } from './questionDraft';

const field = 'input input-bordered input-sm w-full';

/**
 * Writing a question. A preset fixes the buttons (1–5 and 👍/👎 cannot be
 * relabelled, so their results always mean the same thing); Ano/Ne and a link
 * take their own labels. Live in Novinky the minute it is published, with no
 * review in between, so the App Review wording rule sits above the button.
 */
export function QuestionForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const create = useAppStore((s) => s.createAdminQuestion);
  const [d, setD] = useState<QuestionDraft>(() => newDraft('scale'));
  const [busy, setBusy] = useState(false);
  const error = draftError(d);
  const editable = d.preset === 'yesno' || d.preset === 'link';
  const put = (p: Partial<QuestionDraft>) => setD((prev) => ({ ...prev, ...p }));
  const putButton = (i: number, p: Partial<QuestionButton>) =>
    put({ buttons: d.buttons.map((b, j) => (j === i ? { ...b, ...p } : b)) });

  const text = (key: 'promptCz' | 'promptEn' | 'noteCz' | 'noteEn') => (
    <label className="flex flex-col gap-1 text-xs text-base-content/70">
      {t(`admin.questions.${key}`)}
      <input className={field} value={d[key]} onChange={(e) => put({ [key]: e.target.value })} />
    </label>
  );

  const publish = async () => {
    if (error) return;
    setBusy(true);
    const ok = await create(draftToInput(d));
    setBusy(false);
    if (!ok) return void toast.error(t('admin.questions.saveError'));
    toast.success(t('admin.questions.published'));
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-base-300 bg-base-100 p-3">
      <div role="radiogroup" aria-label={t('admin.questions.preset')} className="join">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={d.preset === p}
            onClick={() => setD({ ...newDraft(p), startsAt: d.startsAt, endsAt: d.endsAt })}
            className={`btn btn-xs join-item ${d.preset === p ? 'btn-primary' : 'btn-outline'}`}
          >
            {t(`admin.questions.presets.${p}`)}
          </button>
        ))}
      </div>
      {text('promptCz')}
      {text('promptEn')}
      {text('noteCz')}
      {text('noteEn')}
      {editable && (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-xs text-base-content/70">{t('admin.questions.buttons')}</legend>
          {d.buttons.map((b, i) => (
            <div key={b.key} className="flex gap-1">
              <input
                className={field}
                aria-label={`${b.key} cz`}
                value={b.cz}
                onChange={(e) => putButton(i, { cz: e.target.value })}
              />
              <input
                className={field}
                aria-label={`${b.key} en`}
                value={b.en}
                onChange={(e) => putButton(i, { en: e.target.value })}
              />
            </div>
          ))}
          {d.preset === 'link' && (
            <input
              className={field}
              aria-label={t('admin.questions.url')}
              value={d.buttons[0]?.url ?? ''}
              onChange={(e) => putButton(0, { url: e.target.value })}
            />
          )}
        </fieldset>
      )}
      {/* Stacked on a phone: two datetime fields side by side at 320px run
          their text under the picker icon. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {(['startsAt', 'endsAt'] as const).map((k) => (
          <label
            key={k}
            className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-base-content/70"
          >
            {t(`admin.questions.${k}`)}
            <input
              type="datetime-local"
              className={field}
              value={d[k]}
              onChange={(e) => put({ [k]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-base-content">
        <legend className="mb-1 text-xs text-base-content/70">
          {t('admin.questions.faculties')}
        </legend>
        {ALL_FACULTY_KEYS.filter((f) => f !== 'mendelu').map((f) => (
          <label key={f} className="flex items-center gap-1">
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={d.faculties.includes(f)}
              onChange={(e) =>
                put({
                  faculties: e.target.checked
                    ? [...d.faculties, f]
                    : d.faculties.filter((x) => x !== f),
                })
              }
            />
            {f.toUpperCase()}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-base-content/70">{t('admin.questions.rule')}</p>
      {error && <p className="text-xs text-error">{t(`admin.questions.${error}`)}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          {t('admin.questions.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!!error || busy}
          onClick={publish}
        >
          {t('admin.questions.publish')}
        </button>
      </div>
    </div>
  );
}
