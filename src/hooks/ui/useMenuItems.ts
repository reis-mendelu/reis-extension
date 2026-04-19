import { getMainMenuItems } from '../../components/menuConfig';
import { useUserParams } from '../useUserParams';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../useTranslation';
import type { MenuItem } from '../../components/menuConfig';
import type { ExamSubject, ExamSection, ExamTerm } from '../../types/exams';
import { parseDate } from '../../utils/date';

export function useMenuItems(): MenuItem[] {
  const { params } = useUserParams();
  const language = useAppStore(state => state.language);
  const examStatus = useAppStore(state => state.exams.status);
  const examsData = useAppStore(state => state.exams.data);
  const pinnedPages = useAppStore(state => state.pinnedPages);
  const navPages = useAppStore(state => state.navPages);
  const now = useAppStore(state => state.now);
  const { t } = useTranslation();

  const items = getMainMenuItems(params?.studium ?? '', params?.obdobi ?? '', t, language, pinnedPages, navPages);

  let badgeCount = 0;
  const threshold = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  if (examsData) {
      examsData.forEach((sub: ExamSubject) => {
          sub.sections.forEach((sec: ExamSection) => {
              // 1. Actionable registration window (Available NOW)
              if (sec.status !== 'registered' && sec.terms.some((term: ExamTerm) => !term.full && term.canRegisterNow === true)) {
                  badgeCount++;
              }
              // 2. Upcoming registration window (Anticipation)
              else if (sec.status !== 'registered' && sec.terms.some((term: ExamTerm) => {
                  if (term.registrationStart) {
                      const [d, t] = term.registrationStart.split(' ');
                      const start = parseDate(d, t);
                      return start > now && start <= threshold;
                  }
                  return false;
              })) {
                  badgeCount++;
              }
              // 3. Registered exam (Active involvement)
              else if (sec.status === 'registered') {
                  badgeCount++;
              }
          });
      });
  }

  return items.map(i => {
      if (i.id === 'exams') {
          // If exams loaded, always show the badge (can be 0)
          const isExamsLoaded = examStatus !== 'loading' && examStatus !== 'idle';
          return { ...i, badge: isExamsLoaded ? badgeCount : undefined };
      }
      return i;
  });
}

