import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { Pencil } from 'lucide-react';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { useCourseName } from '../../../hooks/ui/useCourseName';

export interface SubjectSheetHeaderProps {
  courseCode: string;
  /** IS's name for the subject — what a reset goes back to. */
  isName: string;
  titleHref?: string;
  onBack: () => void;
}

/**
 * The subject sheet's header, with the subject's name editable in place: the
 * phone's counterpart of the extension's `EditableCourseTitle`, writing the
 * same `courseNicknames` through the same store action.
 *
 * Not that component reused: its pencil appears on hover and is ~27px, and it
 * leans on Escape to cancel. Here the pencil is always shown and 44px, and
 * Uložit / Zrušit are buttons, because a phone keyboard has neither key.
 *
 * With a nickname set, IS's own name stays visible under it, so a renamed
 * subject can still be matched to what the teacher, the timetable and IS call
 * it — and the way back to that name sits in the editor.
 */
export function SubjectSheetHeader({
  courseCode,
  isName,
  titleHref,
  onBack,
}: SubjectSheetHeaderProps) {
  const { t } = useTranslation();
  const nickname = useAppStore((s) => s.courseNicknames[courseCode]);
  const setCourseNickname = useAppStore((s) => s.setCourseNickname);
  const displayName = useCourseName(courseCode, isName);
  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const hintId = useId();

  // Rendered and focused inside the tap itself: iOS raises the keyboard only
  // for a focus() made while handling the user's gesture, and an effect after
  // the render is already outside it.
  const startEditing = () => {
    flushSync(() => setDraft(displayName));
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(0, input.value.length);
  };

  const cancel = () => setDraft(null);
  const reset = () => {
    setCourseNickname(courseCode, null);
    setDraft(null);
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    // The IS name typed back in is no nickname; the store clears an empty one.
    // No toast: the header changes in place, and a toast covered its close.
    const next = draft?.trim() ?? '';
    setCourseNickname(courseCode, next === isName ? null : next);
    setDraft(null);
  };

  const editor = draft !== null && (
    <form onSubmit={save} className="flex flex-col gap-1.5 pt-0.5 md:max-w-xl">
      <label htmlFor={inputId} className="text-sm font-semibold text-base-content/80">
        {t('mobile.subjectName.label')}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-describedby={hintId}
        placeholder={isName}
        enterKeyHint="done"
        autoComplete="off"
        // text-base is 16px — below that iOS zooms the page in on focus.
        className="input input-bordered h-11 w-full text-base font-semibold"
      />
      {/* Whose name this is, where it shows, and that IS keeps its own — the
          three things a bare pencil left a student to guess. */}
      <p id={hintId} className="text-sm text-base-content/70">
        {t('mobile.subjectName.hint')}
      </p>
      {/* One row while it fits. When the IS name leaves Zrušit and Uložit no
          room, wrap-reverse drops the reset BELOW them: wrapped above, it
          read as the main action. */}
      <div className="flex flex-wrap-reverse items-center gap-x-2 gap-y-1 pt-1">
        {nickname && (
          <button
            type="button"
            onClick={reset}
            className="btn btn-ghost btn-sm -ml-2 h-11 min-h-11 max-w-full justify-start px-2 font-medium text-[var(--tone-primary)]"
          >
            <span className="truncate">{t('mobile.subjectName.reset', { name: isName })}</span>
          </button>
        )}
        <div className="ml-auto flex flex-shrink-0 gap-2">
          <button type="button" onClick={cancel} className="btn btn-ghost h-11 min-h-11">
            {t('mobile.subjectName.cancel')}
          </button>
          <button type="submit" className="btn btn-primary h-11 min-h-11">
            {t('mobile.subjectName.save')}
          </button>
        </div>
      </div>
    </form>
  );

  return (
    <SheetHeader
      eyebrow={courseCode}
      title={displayName}
      subtitle={nickname ? t('mobile.subjectName.inIs', { name: isName }) : undefined}
      titleHref={titleHref}
      onBack={onBack}
      titleSlot={editor || undefined}
      trailing={
        draft === null && (
          <button
            type="button"
            onClick={startEditing}
            aria-label={t('mobile.subjectName.rename')}
            className="btn btn-circle btn-ghost -mr-2 -mt-1.5 min-h-11 min-w-11 flex-shrink-0 text-base-content/70"
          >
            <Pencil className="h-[18px] w-[18px]" />
          </button>
        )
      }
    />
  );
}
