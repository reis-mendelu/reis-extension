import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import { groupTeachersByRole, type SyllabusTeacher } from '../../../utils/mobile/teacherGroups';

export interface TeacherListProps {
  /** The syllabus's `courseInfo.teachers`. */
  teachers: readonly SyllabusTeacher[] | undefined;
}

/**
 * Who teaches the subject, as a row that opens into groups by role.
 *
 * This replaces a comma-joined line under the drawer title: for Ekonometrie
 * four names with their titles wrapping over two lines, no sign of who runs the
 * course, and nothing to tap. Collapsed by default because the drawer's job is
 * the files and the tabs under it; the count says there is more to open.
 *
 * Each name opens the teacher's own page in IS (`clovek.pl`). reIS's person
 * sheet was tried first and rejected — "ten pop up v reisu se mi zas tolik
 * nelíbí": IS's page carries office hours, the full contact block and the
 * teacher's subjects, where the sheet showed little more than a room. A plain
 * `target="_blank"` link: on Capacitor the capture listener in
 * `mobile/openExternal` turns it into the in-app WebView that holds the IS
 * session, and in the extension it is an ordinary new tab.
 *
 * A teacher IS gives no id for is still listed, just not as a link: there is no
 * page to open, and a dead tap is worse than plain text.
 */
export function TeacherList({ teachers }: TeacherListProps) {
  const { t, language } = useTranslation();
  const [open, setOpen] = useState(false);
  const groups = groupTeachersByRole(teachers);
  if (groups.length === 0) return null;
  const count = groups.reduce((n, g) => n + g.teachers.length, 0);

  return (
    <div className="mx-4 mb-2 flex-shrink-0 overflow-hidden rounded-xl border border-base-content/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left active:bg-base-200"
      >
        <span className="flex-1 text-sm font-medium text-base-content">
          {t('mobile.subjects.teachers')}
        </span>
        <span className="text-sm tabular-nums text-base-content/60">{count}</span>
        {open ? (
          <ChevronUp size={16} className="text-base-content/50" />
        ) : (
          <ChevronDown size={16} className="text-base-content/50" />
        )}
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-base-content/10 px-3 pb-2 pt-2">
          {groups.map((group) => (
            <div key={group.role} className="flex flex-col">
              <span className="pb-0.5 text-xs font-semibold text-base-content/70">
                {t(`mobile.subjects.teacherRole.${group.role}`)}
              </span>
              {group.teachers.map((teacher) =>
                teacher.id ? (
                  <a
                    key={teacher.id}
                    href={`https://is.mendelu.cz/auth/lide/clovek.pl?id=${teacher.id};lang=${language}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 items-center gap-2 rounded-lg text-left active:bg-base-200"
                  >
                    <span className="flex-1 text-sm text-base-content">{teacher.name}</span>
                    <ChevronRight size={14} className="text-base-content/40" />
                  </a>
                ) : (
                  <span key={teacher.name} className="flex min-h-11 items-center text-sm">
                    {teacher.name}
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
