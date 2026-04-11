import { useMemo, useState, useEffect, useCallback } from 'react';
import { useErasmus } from '@/hooks/data/useErasmus';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { EuropeMap } from './EuropeMap';
import { ErasmusDrawer } from './ErasmusDrawer';
import { UnfulfilledCoursesSection } from './UnfulfilledCoursesSection';
import { SelectedCoursesCard } from './SelectedCoursesCard';
import { getDeadlineStatus } from '@/utils/erasmusGrants';
import { getUserParams, type UserParams } from '@/utils/userParams';
import { warmupTransferApi } from '@/api/syllabusTransfer';
import type { StudyPlan } from '@/types/studyPlan';

interface ErasmusPanelProps {
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
}

const FACULTY_ABBREV_TO_NAME: Record<string, string> = {
  'PEF': 'Provozně ekonomická fakulta',
  'AF': 'Agronomická fakulta',
  'LDF': 'Lesnická a dřevařská fakulta',
  'FRRMS': 'Fakulta regionálního rozvoje a mezinárodních studií',
  'ZF': 'Zahradnická fakulta',
};

function parseDate(d: string): number {
  const parts = d.replace(/\s/g, '').split('.');
  if (parts.length < 3) return 0;
  return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
}

export function ErasmusPanel({ onOpenSubject, onSearchSubject }: ErasmusPanelProps) {
  const { t } = useTranslation();
  const lang = useAppStore(s => s.language) === 'cz' ? 'cs' : 'en';
  const { reports, loading, countryFile, setCountry, config } = useErasmus();

  const plan = useStudyPlan();
  const selectedCourses = useAppStore(s => s.erasmusSelectedCourses);
  const toggleCourse = useAppStore(s => s.toggleErasmusCourse);

  useEffect(() => { warmupTransferApi().catch(() => {}); }, []);

  const [activeTab, setActiveTab] = useState<'plan' | 'explore'>('plan');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState(false);
  const [userParams, setUserParams] = useState<UserParams | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { getUserParams().then(setUserParams); }, []);

  const currentCountry = useMemo(() => ERASMUS_COUNTRIES.find(c => c.file === countryFile), [countryFile]);
  const countryName = currentCountry ? currentCountry[lang] : '';
  const currentCountryId = currentCountry?.id ?? '';

  const schools = useMemo(() => Array.from(new Set(reports.map(r => r.host.name))).sort(), [reports]);

  const filteredReports = useMemo(() => {
    let base = reports.filter(r => r.stay.durationMonths > 2);
    if (schoolFilter) base = base.filter(r => r.host.name === schoolFilter);
    const fullFaculty = facultyFilter && userParams?.facultyLabel
      ? FACULTY_ABBREV_TO_NAME[userParams.facultyLabel] : null;
    if (fullFaculty) base = base.filter(r => r.student.faculty === fullFaculty);
    return [...base].sort((a, b) => parseDate(b.stay.from) - parseDate(a.stay.from));
  }, [reports, schoolFilter, facultyFilter, userParams]);

  const displayedReports = showAll ? filteredReports : filteredReports.slice(0, 10);

  const handleCountrySelect = useCallback((file: string) => {
    setCountry(file); setDrawerOpen(true); setSchoolFilter(null); setShowAll(false);
  }, [setCountry]);

  const handleClose = useCallback(() => { setDrawerOpen(false); }, []);

  const handleTabChange = (tab: 'plan' | 'explore') => {
    setActiveTab(tab);
    if (tab === 'plan') setDrawerOpen(false);
  };

  useEffect(() => {
    if (!drawerOpen) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [drawerOpen, handleClose]);

  return (
    <div className="h-full flex flex-col">
      {/* Persistent header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold mb-1">{t('erasmus.title')}</h2>
        {config && (() => {
          const ds = getDeadlineStatus(config);
          if (ds.status === 'open') return <span className="badge badge-success badge-sm">{t('erasmus.applicationsOpen')}</span>;
          if (ds.status === 'closingSoon') return <span className="badge badge-warning badge-sm">{t('erasmus.applicationsClose', { days: ds.daysLeft })}</span>;
          if (ds.status === 'announced') return <span className="badge badge-info badge-sm">{t('erasmus.resultsAnnounced', { date: ds.date })}</span>;
          return null;
        })()}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-base-300 shrink-0">
        {(['plan', 'explore'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`flex-1 py-2 text-sm font-medium transition-colors
              ${activeTab === tab
                ? 'border-b-2 border-primary bg-primary/10 text-primary'
                : 'text-base-content/60 hover:bg-base-200'}`}
          >
            {tab === 'plan' ? t('erasmus.tabPlan') : t('erasmus.tabExplore')}
          </button>
        ))}
      </div>

      {/* Plan tab */}
      {activeTab === 'plan' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          <SelectedCoursesCard
            plan={plan ?? { blocks: [] } as unknown as StudyPlan}
            selectedCodes={selectedCourses}
            onToggle={toggleCourse}
          />
          <UnfulfilledCoursesSection
            onOpenSubject={onOpenSubject}
            onSearchSubject={onSearchSubject}
          />
        </div>
      )}

      {/* Explore tab */}
      {activeTab === 'explore' && (
        <div className="flex-1 min-h-0 px-4 pb-4 pt-2">
          <div className="bg-base-200/50 rounded-xl p-2 border border-base-300 h-full">
            <EuropeMap
              selectedCountryId={drawerOpen ? currentCountryId : ''}
              onSelectCountry={id => {
                const c = ERASMUS_COUNTRIES.find(e => e.id === id);
                if (c) handleCountrySelect(c.file);
              }}
              lang={lang}
            />
          </div>
        </div>
      )}

      {/* Drawer — only in explore context */}
      {drawerOpen && activeTab === 'explore' && (
        <ErasmusDrawer
          countryName={countryName}
          filteredReports={filteredReports}
          displayedReports={displayedReports}
          schools={schools}
          schoolFilter={schoolFilter}
          setSchoolFilter={setSchoolFilter}
          facultyFilter={facultyFilter}
          setFacultyFilter={setFacultyFilter}
          userParams={userParams}
          showAll={showAll}
          setShowAll={setShowAll}
          loading={loading}
          config={config}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
