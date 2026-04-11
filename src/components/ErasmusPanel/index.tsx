import { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, CheckCircle2, ExternalLink, AlertTriangle } from 'lucide-react';
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
import { isElectiveGroup, isCompulsoryGroup, isCoreElectiveGroup } from '@/utils/studyPlanUtils';
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
  const { t, language: lang } = useTranslation();
  const { reports, countryFile, setCountry, loading, config } = useErasmus();
  const plan = useStudyPlan();
  const selectedCourses = useAppStore(s => s.erasmusSelectedCourses) || [];
  const toggleCourse = useAppStore(s => s.toggleErasmusCourse);
  const activeTab = useAppStore(s => s.erasmusActiveTab);
  const setActiveTab = useAppStore(s => s.setErasmusActiveTab);
  const planPhase = useAppStore(s => s.erasmusPlanPhase);
  const setPlanPhase = useAppStore(s => s.setErasmusPlanPhase);
  const loadState = useAppStore(s => s.loadErasmusSelectedCourses);

  useEffect(() => { 
    warmupTransferApi();
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

  const totalCreditsSelected = useMemo(() => {
    if (!plan || !plan.blocks) return 0;
    const all = plan.blocks.flatMap(b => (b.groups || []).flatMap(g => g.subjects || []));
    return selectedCourses
      .map(code => {
        const s = all.find(sub => sub && sub.code === code);
        return (s && s.credits < 999) ? s.credits : 0;
      })
      .reduce((a, b) => a + b, 0);
  }, [plan, selectedCourses]);

  const totalCoreCreditsSelected = useMemo(() => {
    if (!plan || !plan.blocks) return 0;
    let sum = 0;
    for (const b of plan.blocks) {
      if (!b || !b.groups) continue;
      for (const g of b.groups) {
        if (!g || !g.subjects) continue;
        if (isCompulsoryGroup(g.name, b.title) || isCoreElectiveGroup(g.name, b.title)) {
          for (const s of g.subjects) {
            if (s && selectedCourses.includes(s.code) && s.credits < 999) sum += s.credits;
          }
        }
      }
    }
    return sum;
  }, [plan, selectedCourses]);

  const filteredReports = useMemo(() => {
    let base = reports.filter(r => r.stay.durationMonths > 2);
    if (schoolFilter) base = base.filter(r => r.host.name === schoolFilter);
    const fullFaculty = facultyFilter && userParams?.facultyLabel
      ? FACULTY_ABBREV_TO_NAME[userParams.facultyLabel] : null;
    if (fullFaculty) base = base.filter(r => r.home.faculty === fullFaculty);
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

      {/* Plan tab */}
      {activeTab === 'plan' && (() => {
        const isMinReached = totalCreditsSelected >= 18;
        const isIdeal = totalCreditsSelected >= 25;
        const progressColor = isIdeal ? 'bg-success' : isMinReached ? 'bg-warning' : 'bg-error';
        const progressPercent = Math.min(100, (totalCreditsSelected / 25) * 100);
        
        return (
          <div className="flex-1 flex flex-col min-h-0">
            {planPhase === 'select' ? (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <UnfulfilledCoursesSection
                    onOpenSubject={onOpenSubject}
                    onSearchSubject={onSearchSubject}
                  />
                </div>
                {selectedCourses.length > 0 && (
                  <div className="shrink-0 border-t border-base-300 bg-base-100 px-4 py-3 flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-base-content/40">{t('erasmus.targetECTS')}</span>
                        <span className={`text-xs font-bold ${isIdeal ? 'text-success' : isMinReached ? 'text-warning-content' : 'text-error'}`}>
                          {totalCreditsSelected} / 18 {t('erasmus.credits')}
                        </span>
                      </div>
                      <button
                        onClick={() => setPlanPhase('review')}
                        className="btn btn-primary btn-sm px-5 h-9 min-h-0"
                      >
                        {t('transfer.checkButton')}
                      </button>
                    </div>
                    <div className="w-full h-1.5 bg-base-300 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${progressColor} transition-all duration-500 ease-out`} 
                        style={{ width: `${progressPercent}%` }} 
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-5">
                <button
                  onClick={() => setPlanPhase('select')}
                  className="flex items-center gap-1.5 text-xs font-medium text-base-content/50 hover:text-primary transition-colors group w-fit"
                >
                  <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  {t('erasmus.myStudyPlan')}
                </button>
                
                <div className="flex flex-col gap-3">
                  <SelectedCoursesCard
                    plan={plan ?? { blocks: [] } as unknown as StudyPlan}
                    selectedCodes={selectedCourses}
                    onToggle={toggleCourse}
                    compulsoryCredits={totalCoreCreditsSelected}
                  />
                  
                  {/* Next steps card */}
                  <div className="bg-base-200/50 rounded-xl p-4 border border-base-300 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <CheckCircle2 size={16} />
                      </div>
                      <h4 className="font-bold text-sm">{t('erasmus.nextSteps')}</h4>
                    </div>
                    <p className="text-[11px] text-base-content/60 leading-relaxed">
                      {t('erasmus.officialApproval')}
                    </p>
                    <a 
                      href={t('erasmus.erasmusCoordinators')}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm gap-2 w-full text-xs font-bold"
                    >
                      {t('erasmus.contactCoordinator')}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Explore tab */}
      {activeTab === 'explore' && (
        <div className="flex-1 min-h-0 px-4 pb-4 pt-2">
          <div className="bg-base-200/50 rounded-xl p-2 border border-base-300 h-full">
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
