import { useMemo, useState, useEffect, useCallback } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import { useErasmus } from '@/hooks/data/useErasmus';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { EuropeMap } from './EuropeMap';
import { ErasmusDrawer } from './ErasmusDrawer';
import { StudentInfoSection } from './StudentInfoSection';
import { LATableA } from './LATableA';
import { ErasmusExportButton } from './ErasmusExportButton';
import { getUserParams, type UserParams } from '@/utils/userParams';
import type { StudyPlan } from '@/types/studyPlan';

const FACULTY_ABBREV_TO_NAME: Record<string, string> = {
  'PEF': 'Provozně ekonomická fakulta',
  'AF': 'Agronomická fakulta',
  'LDF': 'Lesnická a dřevařská fakulta',
  'FRRMS': 'Fakulta regionálního rozvoje a mezinárodních studií',
  'ZF': 'Zahradnická fakulta',
  'ICV': 'Institut celoživotního vzdělávání',
};

interface ErasmusPanelProps {
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
}

export function ErasmusPanel({ onOpenSubject, onSearchSubject }: ErasmusPanelProps) {
  const { t, language } = useTranslation();
  const lang = language === 'en' ? 'en' : 'cs';
  const { reports, countryFile, setCountry, loading, config } = useErasmus();
  const plan = useStudyPlan();
  const tableBCourses = useAppStore(s => s.erasmusTableBCourses);
  const activeTab = useAppStore(s => s.erasmusActiveTab);
  const setActiveTab = useAppStore(s => s.setErasmusActiveTab);
  const loadState = useAppStore(s => s.loadErasmusState);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState(false);
  const [userParams, setUserParams] = useState<UserParams | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { getUserParams().then(setUserParams); }, []);

  const handleCountrySelect = useCallback((file: string) => {
    setCountry(file);
    setDrawerOpen(true);
  }, [setCountry]);

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
    return base;
  }, [reports, schoolFilter, facultyFilter, userParams]);

  const displayedReports = useMemo(() => {
    return showAll ? filteredReports : filteredReports.slice(0, 10);
  }, [filteredReports, showAll]);

  const handleTabChange = (tab: 'plan' | 'explore') => {
    setActiveTab(tab);
    if (tab === 'plan') setDrawerOpen(false);
  };

  const handleClose = useCallback(() => setDrawerOpen(false), []);

  const hasAnyCoursesSelected = Object.values(tableBCourses).some(arr => arr.length > 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-4 pt-3 pb-1 border-b border-base-300">
        {(['plan', 'explore'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-3 py-1.5 rounded-t-lg text-xs font-bold transition-all border-b-2 ${
              activeTab === tab
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-base-content/40 hover:text-base-content/60'
            }`}
          >
            {tab === 'plan' ? t('erasmus.tabPlan') : t('erasmus.tabExplore')}
          </button>
        ))}
      </div>

      {activeTab === 'plan' && (
        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-5">
          <StudentInfoSection userParams={userParams} />

          <LATableA
            plan={plan ?? { blocks: [] } as unknown as StudyPlan}
            onOpenSubject={onOpenSubject}
            onSearchSubject={onSearchSubject}
          />

          <ErasmusExportButton />

          {hasAnyCoursesSelected && (
            <a
              href={t('erasmus.erasmusCoordinators')}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm gap-2 w-full text-xs font-bold"
            >
              {t('erasmus.contactCoordinator')}
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {activeTab === 'explore' && (
        <div className="flex-1 min-h-0 px-4 pb-4 pt-2 flex flex-col gap-2">
          <div className="flex items-start gap-2 px-1 py-1.5 text-[10px] text-base-content/50 leading-relaxed">
            <Info size={12} className="shrink-0 mt-0.5 text-info" />
            <span>{t('erasmus.exploreDisclaimer')}</span>
          </div>
          <div className="bg-base-200/50 rounded-xl p-2 border border-base-300 flex-1 min-h-0">
            <EuropeMap
              selectedCountryId={currentCountryId ? currentCountryId : ''}
              onSelectCountry={id => {
                const c = ERASMUS_COUNTRIES.find(e => e.id === id);
                if (c) handleCountrySelect(c.file);
              }}
              lang={lang}
            />
          </div>
        </div>
      )}

      {drawerOpen && (
        <ErasmusDrawer
          filteredReports={filteredReports}
          displayedReports={displayedReports}
          countryName={countryName}
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
