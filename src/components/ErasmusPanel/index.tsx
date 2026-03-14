import { useMemo, useState, useEffect } from 'react';
import { useErasmus } from '@/hooks/data/useErasmus';
import { useTranslation } from '@/hooks/useTranslation';
import { useAppStore } from '@/store/useAppStore';
import { ERASMUS_COUNTRIES } from '@/constants/erasmusCountries';
import { EuropeMap } from './EuropeMap';
import { ErasmusReportCard } from './ErasmusReportCard';
import type { ErasmusReport } from '@/types/erasmus';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getUserParams, type UserParams } from '@/utils/userParams';
import { ChevronLeft, GraduationCap, School } from 'lucide-react';

function parseDate(d: string): number {
  const parts = d.replace(/\s/g, '').split('.');
  if (parts.length < 3) return 0;
  return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
}

type Step = 'country' | 'school' | 'reports';

export function ErasmusPanel() {
  const { t } = useTranslation();
  const lang = useAppStore(s => s.language) === 'cz' ? 'cs' : 'en';
  const { reports, loading, countryFile, setCountry } = useErasmus();
  
  const [step, setStep] = useState<Step>('country');
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [userParams, setUserParams] = useState<UserParams | null>(null);
  const [showAllInSchool, setShowAllInSchool] = useState(false);

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
    const list = Array.from(new Set(reports.map(r => r.host.name))).sort();
    return list;
  }, [reports]);

  // Personalized sorting: 
  // 1. Matches user's faculty
  // 2. Newest first
  const sortedReportsForSchool = useMemo(() => {
    if (!selectedSchool) return [];
    
    const schoolReports = reports.filter(r => r.host.name === selectedSchool);
    
    return schoolReports.sort((a, b) => {
      if (userParams?.facultyLabel) {
        const aMatches = a.student.faculty.includes(userParams.facultyLabel);
        const bMatches = b.student.faculty.includes(userParams.facultyLabel);
        if (aMatches && !bMatches) return -1;
        if (!aMatches && bMatches) return 1;
      }
      return parseDate(b.stay.from) - parseDate(a.stay.from);
    });
  }, [reports, selectedSchool, userParams]);

  const displayedReports = showAllInSchool ? sortedReportsForSchool : sortedReportsForSchool.slice(0, 5);

  const handleCountrySelect = (file: string) => {
    setCountry(file);
    setStep('school');
    setSelectedSchool(null);
    setShowAllInSchool(false);
  };

  const handleSchoolSelect = (school: string) => {
    setSelectedSchool(school);
    setStep('reports');
    setShowAllInSchool(false);
  };

  const sortedCountries = useMemo(() =>
    [...ERASMUS_COUNTRIES].sort((a, b) => a[lang].localeCompare(b[lang], lang)),
    [lang]
  );

  const goBack = () => {
    if (step === 'reports') setStep('school');
    else if (step === 'school') setStep('country');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-1">
          {step !== 'country' && (
            <button onClick={goBack} className="btn btn-ghost btn-xs btn-circle">
              <ChevronLeft size={16} />
            </button>
          )}
          <h2 className="text-lg font-bold">{t('erasmus.title')}</h2>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-base-content/50 mb-3">
          <span className={step === 'country' ? 'text-primary font-bold' : ''}>
            {step === 'country' ? t('erasmus.selectCountry') : countryName}
          </span>
          {step !== 'country' && <span>/</span>}
          {step === 'school' && (
            <span className="text-primary font-bold">{t('erasmus.selectSchool')}</span>
          )}
          {step === 'reports' && selectedSchool && (
            <span className="text-primary font-bold truncate max-w-[150px]">{selectedSchool}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {step === 'country' && (
          <div className="flex flex-col gap-4">
            <div className="bg-base-200/50 rounded-xl p-2 border border-base-300">
              <EuropeMap
                selectedCountryId={currentCountryId}
                onSelectCountry={id => {
                  const c = ERASMUS_COUNTRIES.find(e => e.id === id);
                  if (c) handleCountrySelect(c.file);
                }}
                lang={lang}
              />
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold px-1 opacity-70 uppercase tracking-tight">
                {t('erasmus.allCountries')}
              </p>
              <Select value={countryFile} onValueChange={handleCountrySelect}>
                <SelectTrigger size="sm" className="w-full bg-base-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedCountries.map(c => (
                    <SelectItem key={c.id} value={c.file}>
                      {c[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 'school' && (
          <div className="flex flex-col gap-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : schools.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-base-content/50 text-sm">
                {t('erasmus.noData')}
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold px-1 opacity-70 uppercase tracking-tight mb-1">
                  {t('erasmus.selectSchoolHint')}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {schools.map(school => (
                    <button
                      key={school}
                      onClick={() => handleSchoolSelect(school)}
                      className="btn btn-outline btn-sm justify-start h-auto py-2 text-left font-normal normal-case border-base-300 hover:bg-base-200"
                    >
                      <School size={14} className="opacity-50 shrink-0" />
                      <span className="truncate">{school}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step === 'reports' && (
          <div className="flex flex-col gap-3">
            {userParams?.facultyLabel && (
              <div className="alert alert-info py-2 text-xs rounded-lg bg-primary/10 border-primary/20 text-primary-content">
                <GraduationCap size={16} />
                <span>
                  {t('erasmus.personalizedFor', { faculty: userParams.facultyLabel })}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {displayedReports.map((report: ErasmusReport) => (
                <ErasmusReportCard key={report.reportId} report={report} />
              ))}
            </div>

            {!showAllInSchool && sortedReportsForSchool.length > 5 && (
              <button
                onClick={() => setShowAllInSchool(true)}
                className="btn btn-ghost btn-sm text-primary"
              >
                {t('erasmus.showMore')} ({sortedReportsForSchool.length - 5})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
