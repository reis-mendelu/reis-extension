import { 
  useState 
} from 'react';
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
  ChevronUp
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { pagesData, injectUserParams } from '../../data/pages';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

interface IsPortalPopoverProps {
  isOpen: boolean;
  onClose: () => void;
}

const ICON_MAP: Record<string, any> = {
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
  const { language } = useTranslation();
  const studiumId = useAppStore(s => s.studiumId);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Content */}
      <div className="relative w-full max-w-7xl max-h-[90vh] bg-base-100 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Close Button - Floated to keep layout clean */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-base-200/50 hover:bg-base-300 rounded-xl transition-colors text-base-content/50 hover:text-base-content"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Grid Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 md:pt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pagesData.map((category) => {
              const Icon = ICON_MAP[category.id] || Info;
              const title = (language === 'en' && category.labelEn) ? category.labelEn : category.label;

              return (
                <div 
                  key={category.id}
                  className="group flex flex-col bg-base-200/30 border border-base-300 rounded-xl p-5 hover:border-primary/30 hover:bg-base-200/50 transition-all duration-200"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-base-100 rounded-xl border border-base-300 shadow-sm group-hover:scale-110 group-hover:text-primary transition-all">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-bold text-base-content leading-tight">{title}</h3>
                  </div>
                  
                  <ul className="flex flex-col gap-2">
                    {(expandedCategories.has(category.id) ? category.children : category.children.slice(0, 5)).map((item) => {
                      const itemLabel = (language === 'en' && item.labelEn) ? item.labelEn : item.label;
                      const isBold = itemLabel.includes('<b>') || itemLabel.includes('<strong>');
                      const cleanLabel = itemLabel.replace(/<\/?[bi]>|<\/?[strong]>/g, '');

                      return (
                        <li key={item.id}>
                          <button
                            onClick={() => handleLinkClick(item.href)}
                            className={`text-sm text-left w-full hover:text-primary hover:underline decoration-primary/30 underline-offset-4 transition-colors ${isBold ? 'font-semibold text-base-content' : 'text-base-content/70'}`}
                          >
                            •  {cleanLabel}
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {category.children.length > 5 && (
                    <button 
                      onClick={() => toggleCategory(category.id)}
                      className="mt-3 text-xs font-semibold text-primary hover:text-primary-focus transition-colors flex items-center gap-1.5 group/btn"
                    >
                      {expandedCategories.has(category.id) ? (
                        <>
                          Zobrazit méně
                          <ChevronUp className="w-3 h-3 group-hover:btn-animate-bounce" />
                        </>
                      ) : (
                        <>
                          Zobrazit dalších {category.children.length - 5}
                          <ChevronDown className="w-3 h-3 group-hover:animate-bounce" />
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
