import { useMemo, useState, useEffect, useCallback } from 'react';
import { useErasmus } from '@/hooks/data/useErasmus';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { EuropeMap } from './EuropeMap';
import { ErasmusReportCard } from './ErasmusReportCard';
import type { ErasmusReport } from '@/types/erasmus';
import { GraduationCap, X, Filter, ChevronDown, Mail } from 'lucide-react';
import { getUserParams, type UserParams } from '@/utils/userParams';
import { getDeadlineStatus } from '@/utils/erasmusGrants';
import { toast } from 'sonner';

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

export function ErasmusPanel() {
  const { t } = useTranslation();
  const lang = useAppStore(s => s.language) === 'cz' ? 'cs' : 'en';
  const { reports, loading, countryFile, setCountry, config } = useErasmus();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [schoolFilter, setSchoolFilter] = useState<string | null>(null);
  const [facultyFilter, setFacultyFilter] = useState(false);
  const [userParams, setUserParams] = useState<UserParams | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    getUserParams().then(setUserParams);
  }, []);

  const currentCountry = useMemo(() =>
    ERASMUS_COUNTRIES.find(c => c.file === countryFile),
    [countryFile]
  );
  const countryName = currentCountry ? currentCountry[lang] : '';
  const currentCountryId = currentCountry?.id ?? '';

  const schools = useMemo(() => {
    return Array.from(new Set(reports.map(r => r.host.name))).sort();
  }, [reports]);

  const filteredReports = useMemo(() => {
    let base = reports.filter(r => r.stay.durationMonths > 2);
    if (schoolFilter) {
      base = base.filter(r => r.host.name === schoolFilter);
    }
    const fullFaculty = facultyFilter && userParams?.facultyLabel
      ? FACULTY_ABBREV_TO_NAME[userParams.facultyLabel] : null;
    if (fullFaculty) {
      base = base.filter(r => r.student.faculty === fullFaculty);
    }
    return [...base].sort((a, b) => parseDate(b.stay.from) - parseDate(a.stay.from));
  }, [reports, schoolFilter, facultyFilter, userParams]);

  const displayedReports = showAll ? filteredReports : filteredReports.slice(0, 10);


  const handleCountrySelect = useCallback((file: string) => {
    setCountry(file);
    setDrawerOpen(true);
    setSchoolFilter(null);
    setShowAll(false);
  }, [setCountry]);

  const handleClose = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [drawerOpen, handleClose]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-lg font-bold mb-1">{t('erasmus.title')}</h2>
        <p className="text-xs text-base-content/50 mb-2">{t('erasmus.selectCountry')}</p>
        {config && (() => {
          const ds = getDeadlineStatus(config);
          if (ds.status === 'open') return <span className="badge badge-success badge-sm">{t('erasmus.applicationsOpen')}</span>;
          if (ds.status === 'closingSoon') return <span className="badge badge-warning badge-sm">{t('erasmus.applicationsClose', { days: ds.daysLeft })}</span>;
          if (ds.status === 'announced') return <span className="badge badge-info badge-sm">{t('erasmus.resultsAnnounced', { date: ds.date })}</span>;
          return null;
        })()}
      </div>

      <div className="flex-1 min-h-0 px-4 pb-4">
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

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end items-stretch p-0 sm:p-4 isolate">
          <div className="absolute inset-0 bg-black/15 animate-in fade-in" onClick={handleClose} />
          <div className="w-full flex justify-end items-start h-full pt-0 pb-0 sm:pt-10 sm:pb-10 relative z-10 pointer-events-none">
            <div
              role="dialog"
              className="bg-base-100 shadow-2xl rounded-2xl flex flex-col h-full animate-in slide-in-from-right pointer-events-auto border border-base-300 w-full sm:w-[600px]"
            >
              {/* Drawer header */}
              <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-base-300">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base">{countryName}</h3>
                  <p className="text-xs text-base-content/50">
                    {filteredReports.length} {t('erasmus.reports')}
                    {schoolFilter && ` · ${schoolFilter}`}
                  </p>
                  {config && userParams?.facultyLabel && config.faculties[userParams.facultyLabel] && (
                    <p className="text-[11px] text-base-content/50 flex items-center gap-2 mt-1 px-0.5">
                      <span className="shrink-0">{t('erasmus.coordinator')}:</span>
                      <span className="font-medium text-base-content/80 truncate">
                        {config.faculties[userParams.facultyLabel].coordinator}
                      </span>
                      <button 
                        onClick={() => {
                          const email = config.faculties[userParams.facultyLabel].email;
                          navigator.clipboard.writeText(email).then(() => {
                            toast.success(t('common.copiedToClipboard'));
                          }).catch(err => {
                            console.error('Failed to copy!', err);
                            const input = document.createElement('input');
                            input.value = email;
                            document.body.appendChild(input);
                            input.select();
                            document.execCommand('copy');
                            document.body.removeChild(input);
                            toast.success(t('common.copiedToClipboard'));
                          });
                        }}
                        className="btn btn-ghost btn-xs w-6 h-6 p-0 min-h-0 text-primary hover:bg-primary/10 transition-colors shrink-0"
                        title={config.faculties[userParams.facultyLabel].email}
                      >
                        <Mail size={12} />
                      </button>
                    </p>
                  )}
                </div>
                <button onClick={handleClose} className="btn btn-ghost btn-xs btn-circle">
                  <X size={16} />
                </button>
              </div>

              {/* Filters */}
              {!loading && (
                <div className="px-4 pt-3 pb-1">
                  <div className="flex items-center gap-2">
                    {schools.length > 1 && (
                      <div className="dropdown dropdown-bottom flex-1">
                        <div 
                          tabIndex={0} 
                          role="button" 
                          className="btn btn-sm btn-ghost border border-base-300 w-full justify-between font-normal px-3 pl-8 relative"
                        >
                          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                          <span className="truncate">{schoolFilter ?? t('erasmus.allSchools')}</span>
                          <ChevronDown size={14} className="opacity-50 shrink-0" />
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-xl bg-base-100 rounded-xl border border-base-300 w-full mt-1 max-h-60 overflow-y-auto">
                          <li>
                            <button 
                              className={`rounded-lg ${!schoolFilter ? 'bg-primary text-primary-content' : ''}`}
                              onClick={() => {
                                setSchoolFilter(null);
                                setShowAll(false);
                                (document.activeElement as HTMLElement)?.blur();
                              }}
                            >
                              {t('erasmus.allSchools')}
                            </button>
                          </li>
                          {schools.map(school => (
                            <li key={school}>
                              <button 
                                className={`rounded-lg ${schoolFilter === school ? 'bg-primary text-primary-content' : ''}`}
                                onClick={() => {
                                  setSchoolFilter(school);
                                  setShowAll(false);
                                  (document.activeElement as HTMLElement)?.blur();
                                }}
                              >
                                {school}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {userParams?.facultyLabel && FACULTY_ABBREV_TO_NAME[userParams.facultyLabel] && (
                      <button
                        onClick={() => { setFacultyFilter(!facultyFilter); setShowAll(false); }}
                        className={`btn btn-sm w-32 gap-1.5 shrink-0 border ${facultyFilter ? 'btn-primary border-primary' : 'btn-ghost border-base-300'}`}
                      >
                        <GraduationCap size={14} />
                        {userParams.facultyLabel}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Drawer content */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="loading loading-spinner loading-md" />
                  </div>
                ) : filteredReports.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-base-content/50 text-sm">
                    {t('erasmus.noData')}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2">
                      {displayedReports.map((report: ErasmusReport) => (
                        <ErasmusReportCard key={report.reportId} report={report} />
                      ))}
                    </div>

                    {!showAll && filteredReports.length > 10 && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="btn btn-ghost btn-sm text-primary"
                      >
                        {t('erasmus.showMore')} ({filteredReports.length - 10})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
