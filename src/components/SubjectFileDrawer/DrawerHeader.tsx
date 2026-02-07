import { ExternalLink } from 'lucide-react';
import type { DrawerHeaderProps } from './types';
import { HeaderActions } from './Header/HeaderActions';
import { CourseMeta } from './Header/CourseMeta';
import { HeaderTabs } from './Header/HeaderTabs';
import { useTranslation } from '../../hooks/useTranslation';

function formatDate(ds: string, t: (k: string) => string) {
    if (!ds || ds.length !== 8) return '';
    const d = new Date(parseInt(ds.substring(0, 4)), parseInt(ds.substring(4, 6)) - 1, parseInt(ds.substring(6, 8)));
    const dayNames = [t('days.sunday'), t('days.monday'), t('days.tuesday'), t('days.wednesday'), t('days.thursday'), t('days.friday'), t('days.saturday')];
    return `${dayNames[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

function getBadge(l: any, t: (k: string) => string) {
    if (!l) return null;
    if (l.isExam) {
        const test = (l.courseName || '').toLowerCase().includes('test') || (l.sectionName || '').toLowerCase().includes('test');
        return { label: test ? t('course.badge.test') : t('course.badge.exam'), cls: test ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700' };
    }
    return l.isSeminar === 'true' ? { label: t('course.badge.seminar'), cls: 'bg-emerald-100 text-emerald-700' } : { label: t('course.badge.lecture'), cls: 'bg-blue-100 text-blue-700' };
}

export function DrawerHeader({ lesson, courseId, courseInfo, selectedCount, isDownloading, downloadProgress, activeTab, onClose, onDownload, onTabChange }: DrawerHeaderProps) {
    const { t, language } = useTranslation();
    const badge = getBadge(lesson, t), isSearch = lesson?.isFromSearch;

    return (
        <div className="px-6 py-4 border-b border-base-300 bg-base-100 z-20">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    {!isSearch ? (<>{badge && <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>{badge.label}</span>}{lesson?.date && <span className="text-sm text-base-content/60">{formatDate(lesson.date, t)}</span>}</>)
                    : (<div className="flex items-center gap-2">
                        {courseInfo?.status && <span className="px-2 py-0.5 rounded text-xs font-bold bg-base-300 text-base-content/70 capitalize">
                            {courseInfo.status.toLowerCase().includes('povinný') ? t('course.status.povinný') : 
                             courseInfo.status.toLowerCase().includes('volitelný') ? t('course.status.volitelný') : 
                             courseInfo.status.toLowerCase().includes('povinně volitelný') ? t('course.status.povinně volitelný') : 
                             courseInfo.status}
                        </span>}
                        {courseInfo?.credits && <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary capitalize">
                            {courseInfo.credits.toLowerCase().replace('kreditů', language === 'cs' ? 'kreditů' : 'credits' ).replace('kredity', language === 'cs' ? 'kredity' : 'credits').replace('kredit', language === 'cs' ? 'kredit' : 'credit')}
                        </span>}
                    </div>)}
                </div>
                <HeaderActions selectedCount={selectedCount} isDownloading={isDownloading} downloadProgress={downloadProgress} onDownload={onDownload} onClose={onClose} />
            </div>
            <div className="mb-2">
                {courseId ? <a href={`https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=${courseId};lang=${language === 'cs' ? 'cz' : 'en'}`} target="_blank" rel="noopener noreferrer" className="clickable-link text-xl font-bold flex items-center gap-1"><span>{lesson?.courseName}</span><ExternalLink size={14} className="opacity-50" /></a>
                : <span className="text-xl font-bold text-base-content">{lesson?.courseName}</span>}
            </div>
            <CourseMeta lesson={lesson} courseInfo={courseInfo} isSearchContext={isSearch} />
            <HeaderTabs activeTab={activeTab} onTabChange={onTabChange} />
        </div>
    );
}
