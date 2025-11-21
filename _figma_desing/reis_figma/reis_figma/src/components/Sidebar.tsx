import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  User, 
  GraduationCap, 
  Settings, 
  LogOut,
  ClipboardCheck,
  FileQuestion,
  BookOpen,
  Award,
  BookMarked,
  ClipboardList,
  Wifi,
  MessageSquare,
  Mail,
  UserCircle,
  LayoutDashboard
} from 'lucide-react';
import mendeluLogo from 'figma:asset/5476481a00cb4d91249cc77b7e8c68fee66f34f1.png';

interface MenuItem {
  id: string;
  label: string;
  shortLabel: string;
  popupLabel?: string; // Label to show in popup header
  icon: React.ReactNode;
  children?: { label: string; id: string; icon?: React.ReactNode }[];
  danger?: boolean;
  href?: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [activeItem, setActiveItem] = useState<string>('');
  const [popupItem, setPopupItem] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const mainMenuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Domů',
      shortLabel: 'Domů',
      icon: <Home className="w-6 h-6" />
    },
    {
      id: 'portal',
      label: 'Můj portál',
      shortLabel: 'Portál',
      icon: <LayoutDashboard className="w-6 h-6" />,
      children: [
        { id: 'zkousky', label: 'Zkoušky', icon: <ClipboardCheck className="w-4 h-4" /> },
        { id: 'cvicne-testy', label: 'Cvičné testy', icon: <FileQuestion className="w-4 h-4" /> },
        { id: 'zapisy-predmetu', label: 'Zápisy předmětů', icon: <BookOpen className="w-4 h-4" /> }
      ]
    },
    {
      id: 'o-studiu',
      label: 'O studiu',
      shortLabel: 'Studium',
      popupLabel: 'Studium',
      icon: <GraduationCap className="w-6 h-6" />,
      children: [
        { id: 'hodnoceni-uspesnosti', label: 'Hodnocení úspěšnosti předmětů', icon: <Award className="w-4 h-4" /> },
        { id: 'studijni-plany', label: 'Studijní plány', icon: <BookMarked className="w-4 h-4" /> },
        { id: 'zadosti-formular', label: 'Žádosti a formuláře', icon: <ClipboardList className="w-4 h-4" /> },
        { id: 'wifi', label: 'Nastavení WiFi', icon: <Wifi className="w-4 h-4" /> }
      ]
    }
  ];

  const bottomMenuItems: MenuItem[] = [
    {
      id: 'teams',
      label: 'Teams',
      shortLabel: 'Teams',
      icon: <MessageSquare className="w-6 h-6" />,
      href: 'https://teams.microsoft.com'
    },
    {
      id: 'outlook',
      label: 'Outlook',
      shortLabel: 'Outlook',
      icon: <Mail className="w-6 h-6" />,
      href: 'https://outlook.office.com'
    },
    {
      id: 'profil',
      label: 'Profil',
      shortLabel: 'Profil',
      icon: <UserCircle className="w-6 h-6" />
    }
  ];

  const settingsMenuItems: MenuItem[] = [
    {
      id: 'nastaveni',
      label: 'Nastavení',
      shortLabel: 'Nastavení',
      icon: <Settings className="w-5 h-5" />
    }
  ];

  const handleItemClick = (item: MenuItem) => {
    if (item.children) {
      if (popupItem === item.id) {
        setPopupItem(null);
        setPopupPosition(null);
      } else {
        openPopup(item);
      }
    } else {
      setActiveItem(item.id);
      setPopupItem(null);
      setPopupPosition(null);
    }
  };

  const openPopup = (item: MenuItem) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    setPopupItem(item.id);
    if (buttonRefs.current[item.id]) {
      const buttonRect = buttonRefs.current[item.id]!.getBoundingClientRect();
      setPopupPosition({ 
        top: buttonRect.top, 
        left: buttonRect.right + 8 
      });
    }
  };

  const scheduleClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setPopupItem(null);
      setPopupPosition(null);
    }, 300);
  };

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
  };

  const handleMouseEnter = (item: MenuItem) => {
    if (item.children) {
      // Cancel any pending close
      cancelClose();
      
      // If popup is already open for this item, do nothing
      if (popupItem === item.id) {
        return;
      }
      
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = setTimeout(() => {
        openPopup(item);
      }, 200);
    }
  };

  const handleMouseLeave = (item: MenuItem) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Don't schedule close if the popup for this item is already open
    // (user is moving to the popup)
    if (popupItem !== item.id) {
      return;
    }
    // Schedule close with delay
    scheduleClose();
  };

  const handlePopupMouseEnter = () => {
    // Cancel close when entering popup
    cancelClose();
  };

  const handlePopupMouseLeave = () => {
    // Schedule close when leaving popup
    scheduleClose();
  };

  const activeMenuData = mainMenuItems.find(item => item.id === popupItem);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  return (
    <>
      {/* Sidebar */}
      <aside className="fixed left-0 top-14 w-16 bg-white flex flex-col h-[calc(100vh-3.5rem)] z-[120]">
        
        {/* Main navigation icons */}
        <nav className="flex-1 flex flex-col items-center py-4 gap-3 overflow-y-auto scrollbar-hide">
          {mainMenuItems.map(item => (
            <button
              key={item.id}
              ref={el => buttonRefs.current[item.id] = el}
              onClick={() => handleItemClick(item)}
              className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-all relative group ${
                activeItem === item.id || popupItem === item.id
                  ? 'bg-[#8DC843]/10 text-[#8DC843]' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
              onMouseEnter={() => handleMouseEnter(item)}
              onMouseLeave={() => handleMouseLeave(item)}
            >
              {item.icon}
              <span className="text-[10px] mt-1 text-center leading-tight">{item.shortLabel}</span>
            </button>
          ))}
        </nav>

        {/* Bottom icons - Teams, Outlook, Profile */}
        <nav className="flex flex-col items-center pb-4 gap-3 pt-4">
          {bottomMenuItems.map(item => 
            item.href ? (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-all ${
                  activeItem === item.id 
                    ? 'bg-[#8DC843]/10 text-[#8DC843]' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                <span className="text-[10px] mt-1 text-center leading-tight">{item.shortLabel}</span>
              </a>
            ) : (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-all ${
                  activeItem === item.id 
                    ? 'bg-[#8DC843]/10 text-[#8DC843]' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                <span className="text-[10px] mt-1 text-center leading-tight">{item.shortLabel}</span>
              </button>
            )
          )}
        </nav>
      </aside>

      {/* Popup rendered outside sidebar - with fixed positioning */}
      <AnimatePresence>
        {popupItem && activeMenuData && activeMenuData.children && popupPosition && (
          <>
            {/* Backdrop - Lower z-index than sidebar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/10 z-[100]"
              onClick={() => {
                setPopupItem(null);
                setPopupPosition(null);
              }}
            />
            
            {/* Popup Menu - Highest z-index */}
            <motion.div
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: popupPosition.top,
                left: popupPosition.left
              }}
              className="bg-white rounded-lg shadow-xl border border-gray-200 min-w-[240px] z-[130]"
              onMouseEnter={handlePopupMouseEnter}
              onMouseLeave={handlePopupMouseLeave}
            >
              {/* Invisible bridge to fill the 8px gap */}
              <div 
                className="absolute -left-4 top-0 bottom-0 w-6 bg-transparent pointer-events-auto"
                onMouseEnter={handlePopupMouseEnter}
              />
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-sm text-gray-900">{activeMenuData.popupLabel || activeMenuData.label}</span>
              </div>
              <div className="py-1">
                {activeMenuData.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => {
                      setActiveItem(child.id);
                      setPopupItem(null);
                      setPopupPosition(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      activeItem === child.id 
                        ? 'bg-[#8DC843]/10 text-[#8DC843]' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {child.icon && (
                      <span className={activeItem === child.id ? 'text-[#8DC843]' : 'text-gray-500'}>
                        {child.icon}
                      </span>
                    )}
                    <span className="text-sm">{child.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}