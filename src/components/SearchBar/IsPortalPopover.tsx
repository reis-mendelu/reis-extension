import { useState, useMemo } from 'react';
import {
  Info,
  GraduationCap,
  Microscope,
  Monitor,
  Calendar,
  FileText,
  Cpu,
  Database,
  BookOpen,
  Gamepad2,
  User,
  ShieldCheck,
  Settings,
  X,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { pagesData, injectUserParams } from '../../data/pages';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

interface IsPortalPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'portal-info': Info,
  'moje-studium': GraduationCap,
  'veda-vyzkum': Microscope,
  'elearning': Monitor,
  'osobni-management': Calendar,
  'e-agenda': FileText,
  'technologie': Cpu,
  'sprava-is': Database,
  'dokumentace': BookOpen,
  'herna': Gamepad2,
  'personalizace': User,
  'nastaveni-is': Settings,
  'ochrana-udaju': ShieldCheck,
};

export function IsPortalPopover({ isOpen, onClose }: IsPortalPopoverProps) {
  const { t, language } = useTranslation();
  const studiumId = useAppStore(s => s.studiumId);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');

  const strip = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedFilter = strip(filter.trim());

  const filteredCategories = useMemo(() => {
    if (!normalizedFilter) return pagesData;

    return pagesData
      .map(category => {
        const catLabel = strip((language === 'en' && category.labelEn) ? category.labelEn : category.label);
        const matchingChildren = category.children.filter(item => {
          const itemLabel = strip((language === 'en' && item.labelEn) ? item.labelEn : item.label);
          return itemLabel.includes(normalizedFilter);
        });

        if (catLabel.includes(normalizedFilter)) return category;
        if (matchingChildren.length > 0) return { ...category, children: matchingChildren };
        return null;
      })
      .filter(Boolean) as typeof pagesData;
  }, [normalizedFilter, language]);

  if (!isOpen) return null;

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLinkClick = (href: string) => {
    const finalUrl = injectUserParams(href, studiumId, language === 'en' ? 'en' : 'cz');
    window.open(finalUrl, '_blank');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Content Container */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-base-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Header: filter + close */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder={t('search.filterPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 bg-base-200 border border-base-300 rounded-xl text-sm text-base-content placeholder-base-content/50 focus:outline-none focus:border-primary/50 transition-colors"
              autoFocus
            />
          </div>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-base-200 rounded-xl transition-colors text-base-content/50 hover:text-base-content"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="flex flex-col gap-4">
            {filteredCategories.length === 0 && (
              <div className="py-8 text-center text-sm text-base-content/50">
                {t('search.empty')}
              </div>
            )}

            {filteredCategories.map(category => {
              const Icon = ICON_MAP[category.id] || Info;
              const title = (language === 'en' && category.labelEn) ? category.labelEn : category.label;
              const isFiltering = normalizedFilter.length > 0;
              const showAll = isFiltering || expandedCategories.has(category.id);
              const visibleChildren = showAll ? category.children : category.children.slice(0, 5);
              const hiddenCount = category.children.length - 5;

              return (
                <div key={category.id} className="card bg-base-200/30 border border-base-300 overflow-hidden">
                  {/* Category header — mimics IS grey bar */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-base-200">
                    <Icon className="w-5 h-5 text-base-content/70" />
                    <h3 className="font-bold text-sm text-base-content">{title}</h3>
                  </div>

                  {/* Child links */}
                  <ul className="px-4 py-3 flex flex-col gap-1.5">
                    {visibleChildren.map(item => {
                      const itemLabel = (language === 'en' && item.labelEn) ? item.labelEn : item.label;
                      const isBold = itemLabel.includes('<b>') || itemLabel.includes('<strong>');
                      const cleanLabel = itemLabel.replace(/<\/?[bi]>|<\/?[strong]>/g, '');

                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => handleLinkClick(item.href)}
                            className={`text-sm text-left w-full hover:text-primary hover:underline decoration-primary/30 underline-offset-4 transition-colors ${isBold ? 'font-semibold text-base-content' : 'text-base-content/70'}`}
                          >
                            &bull;  {cleanLabel}
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {!isFiltering && hiddenCount > 0 && (
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="px-4 pb-3 text-xs font-semibold text-primary hover:text-primary-focus transition-colors flex items-center gap-1.5"
                    >
                      {expandedCategories.has(category.id) ? (
                        <>
                          {language === 'en' ? 'Show less' : 'Zobrazit méně'}
                          <ChevronUp className="w-3 h-3" />
                        </>
                      ) : (
                        <>
                          {language === 'en' ? `Show ${hiddenCount} more` : `Zobrazit dalších ${hiddenCount}`}
                          <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
