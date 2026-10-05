import { useRef, useState } from 'react';
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
  const save = (e: FormEvent) => {
    e.preventDefault();
    // The IS name typed back in is no nickname; the store clears an empty one.
    setCourseNickname(courseCode, draft?.trim() === isName ? null : draft);
    setDraft(null);
  };
  const reset = () => {
    setCourseNickname(courseCode, null);
    setDraft(null);
  };

  const editor = draft !== null && (
    <form onSubmit={save} className="flex flex-col gap-2 pt-0.5 md:max-w-xl">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={t('mobile.subjectName.label')}
        placeholder={isName}
        enterKeyHint="done"
        autoComplete="off"
        // text-base is 16px — below that iOS zooms the page in on focus.
        className="input input-bordered h-11 w-full text-base font-semibold"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={cancel} className="btn btn-ghost h-11 min-h-11">
          {t('mobile.subjectName.cancel')}
        </button>
        <button type="submit" className="btn btn-primary h-11 min-h-11">
          {t('mobile.subjectName.save')}
        </button>
      </div>
      {/* Its own line: beside Zrušit and Uložit it left neither room at 320px. */}
      {nickname && (
        <button
          type="button"
          onClick={reset}
          className="btn btn-ghost btn-sm -ml-2 h-11 min-h-11 self-start px-2 font-medium text-[var(--tone-primary)]"
        >
          {t('mobile.subjectName.reset')}
        </button>
      )}
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
