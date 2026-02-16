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

function getBadge(l: { isExam?: boolean; courseName?: string; sectionName?: string; isSeminar?: string } | null, t: (k: string) => string) {
    if (!l) return null;
    if (l.isExam) {
        const test = (l.courseName || '').toLowerCase().includes('test') || (l.sectionName || '').toLowerCase().includes('test');
        return { label: test ? t('course.badge.test') : t('course.badge.exam'), cls: 'bg-error/10 text-error' };
    }
    return l.isSeminar === 'true' ? { label: t('course.badge.seminar'), cls: 'bg-info/10 text-info' } : { label: t('course.badge.lecture'), cls: 'bg-primary/10 text-primary' };
}

export function DrawerHeader({ lesson, courseId, courseInfo, subjectInfo, selectedCount, isDownloading, downloadProgress, activeTab, onClose, onDownload, onTabChange }: DrawerHeaderProps) {
    const { t, language } = useTranslation();
    const badge = getBadge(lesson, t), isSearch = lesson?.isFromSearch;

    return (
        <div className="px-6 py-4 border-b border-base-300 bg-base-100 z-20">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    {!isSearch ? (<>
                        {badge && <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.cls}`}>{badge.label}</span>}
                        {lesson?.date && <span className="px-2 py-0.5 rounded text-xs font-bold bg-base-300 text-base-content/70">{formatDate(lesson.date, t)}</span>}
                    </>)
                    : (<div className="flex items-center gap-2">
                        {courseInfo?.status && <span className="px-2 py-0.5 rounded text-xs font-bold bg-base-300 text-base-content/70 capitalize">
                            {courseInfo.status.toLowerCase().includes('povinný') ? t('course.status.povinný') : 
                             courseInfo.status.toLowerCase().includes('volitelný') ? t('course.status.volitelný') : 
                             courseInfo.status.toLowerCase().includes('povinně volitelný') ? t('course.status.povinně volitelný') : 
                            courseInfo.status}
                        </span>}
                        {courseInfo?.credits && <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary capitalize">
                            {courseInfo.credits.toLowerCase().replace('kreditů', language === 'cz' ? 'kreditů' : 'credits' ).replace('kredity', language === 'cz' ? 'kredity' : 'credits').replace('kredit', language === 'cz' ? 'kredit' : 'credit')}
                        </span>}
                    </div>)}
                </div>
                <HeaderActions selectedCount={selectedCount} isDownloading={isDownloading} downloadProgress={downloadProgress} onDownload={onDownload} onClose={onClose} />
            </div>
            <div className="mb-2">
                {(() => {
                    // Selection logic consistent with Sidebar.tsx:
                    // 1. Store Name (SubjectInfo)
                    // 2. Syllabus Name (CourseMetadata)
                    // 3. Store DisplayName (SubjectInfo fallback)
                    // 4. Lesson Name (BlockLesson)
                    const storeName = language === 'cz' ? subjectInfo?.nameCs : subjectInfo?.nameEn;
                    
                    const syllabusName = language === 'cz' 
                        ? (courseInfo?.courseNameCs || courseInfo?.courseName)
                        : (courseInfo?.courseNameEn || courseInfo?.courseName);
                    
                    const storeDisplayName = subjectInfo?.displayName ? subjectInfo.displayName.replace(subjectInfo.subjectCode, '').trim() : null;
                        
                    const displayName = storeName || syllabusName || storeDisplayName || lesson?.courseName;
                    
                    return courseId ? 
                        <a href={`https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=${courseId};lang=${language === 'cz' ? 'cz' : 'en'}`} target="_blank" rel="noopener noreferrer" className="clickable-link text-xl font-bold flex items-center gap-1">
                            <span>{displayName}</span>
                            <ExternalLink size={14} className="opacity-50" />
                        </a>
                        : <span className="text-xl font-bold text-base-content">{displayName}</span>;
                })()}
            </div>
            <CourseMeta lesson={lesson} courseInfo={courseInfo} isSearchContext={!!isSearch} />
            <HeaderTabs 
                activeTab={activeTab} 
                onTabChange={onTabChange} 
                disabledTabs={!subjectInfo?.subjectId ? ['files', 'classmates'] : []}
            />
        </div>
    );
}
