import type { SearchResult } from './types';
import type { AppView } from '../../types/app';

interface ActionDeps {
  setCurrentView: (v: AppView) => void;
  setTheme: (t: 'mendelu' | 'mendelu-dark') => void;
  setLanguage: (l: 'cz' | 'en') => void;
  openFeedback: () => void;
  theme: string;
  language: string;
  t: (key: string) => string;
}

export function getCommandActions(deps: ActionDeps): SearchResult[] {
  const { setCurrentView, setTheme, setLanguage, openFeedback, theme, language, t } = deps;

  const isDark = theme === 'mendelu-dark';
  const isCzech = language === 'cz';

  return [
    {
      id: 'action-calendar',
      title: t('commands.openCalendar'),
      type: 'action',
      detail: t('commands.navigation'),
      keywords: ['kalendář', 'rozvrh', 'calendar', 'schedule'],
      onExecute: () => setCurrentView('calendar'),
    },
    {
      id: 'action-exams',
      title: t('commands.openExams'),
      type: 'action',
      detail: t('commands.navigation'),
      keywords: ['zkoušky', 'termíny', 'exams', 'tests'],
      onExecute: () => setCurrentView('exams'),
    },
    {
      id: 'action-subjects',
      title: t('commands.openSubjects'),
      type: 'action',
      detail: t('commands.navigation'),
      keywords: ['předměty', 'subjects', 'courses'],
      onExecute: () => setCurrentView('subjects'),
    },
    {
      id: 'action-toggle-theme',
      title: isDark ? t('commands.switchToLight') : t('commands.switchToDark'),
      type: 'action',
      detail: t('commands.settings'),
      keywords: ['tmavý', 'světlý', 'dark', 'light', 'theme', 'režim', 'mode'],
      onExecute: () => setTheme(isDark ? 'mendelu' : 'mendelu-dark'),
    },
    {
      id: 'action-switch-lang',
      title: isCzech ? t('commands.switchToEnglish') : t('commands.switchToCzech'),
      type: 'action',
      detail: t('commands.settings'),
      keywords: ['čeština', 'angličtina', 'czech', 'english', 'jazyk', 'language'],
      onExecute: () => setLanguage(isCzech ? 'en' : 'cz'),
    },
    {
      id: 'action-feedback',
      title: t('commands.openFeedback'),
      type: 'action',
      detail: t('commands.actions'),
      keywords: ['zpětná vazba', 'feedback', 'bug', 'chyba', 'nápad', 'idea'],
      onExecute: openFeedback,
    },
    {
      id: 'action-erasmus',
      title: t('commands.openErasmus'),
      type: 'action',
      detail: t('commands.navigation'),
      keywords: ['erasmus', 'pobyt', 'zahraničí', 'study abroad', 'exchange'],
      onExecute: () => setCurrentView('erasmus'),
    },
  ];
}
