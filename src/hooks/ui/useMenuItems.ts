import { getMainMenuItems } from '../../components/menuConfig';
import { useUserParams } from '../useUserParams';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../useTranslation';
import type { MenuItem } from '../../components/menuConfig';
import type { ExamSubject, ExamSection, ExamTerm } from '../../types/exams';

export function useMenuItems(): MenuItem[] {
  const { params } = useUserParams();
  const language = useAppStore(state => state.language);
  const examStatus = useAppStore(state => state.exams.status);
  const examsData = useAppStore(state => state.exams.data);
  const pinnedPages = useAppStore(state => state.pinnedPages);
  const { t } = useTranslation();

  const items = getMainMenuItems(params?.studium ?? '', params?.obdobi ?? '', t, language, pinnedPages);

  let availableExamsCount = 0;
  if (examsData) {
      examsData.forEach((sub: ExamSubject) => {
          sub.sections.forEach((sec: ExamSection) => {
              if (sec.status !== 'registered' && sec.terms.some((term: ExamTerm) => !term.full && term.canRegisterNow === true)) {
                  availableExamsCount++;
              }
          });
      });
  }

  return items.map(i => {
      if (i.id === 'exams') {
          // If exams loaded, always show the badge (can be 0)
          const isExamsLoaded = examStatus !== 'loading' && examStatus !== 'idle';
          return { ...i, badge: isExamsLoaded ? availableExamsCount : undefined };
      }
      return i;
  });
}
