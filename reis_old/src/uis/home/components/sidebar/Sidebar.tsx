import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { getMainMenuItems, getSettingsMenuItems, type MenuItem } from './menuConfig';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseLeave: () => void;

  onNavigateSchedule: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>(['o-studiu']);
  const [activeItem, setActiveItem] = useState<string>('dashboard');
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  // Fetch user data on mount
  useEffect(() => {
    const cachedUserId = localStorage.getItem("user_id");
    if (cachedUserId) {
      setUserId(cachedUserId);
    }

    // Fetch user name from stored subjects
    const subjects = localStorage.getItem("subjects");
    if (subjects) {
      try {
        const parsed = JSON.parse(subjects);
        if (parsed.userName) {
          setUserName(parsed.userName);
        }
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleItemClick = (item: MenuItem | { id: string, href?: string, onClick?: () => void }) => {
    // If item is expandable, toggle it (unless it also has an href/onClick, but usually expandable items are just parents)
    if ('expandable' in item && item.expandable) {
      toggleExpand(item.id);
      return;
    }

    // Set active
    setActiveItem(item.id);

    // Handle navigation
    if (item.href) {
      // Check if it's an external link or absolute URL
      if (item.href.startsWith('http')) {
        window.location.href = item.href;
      } else {
        // Internal routing if we had it, or just fallback
        window.location.href = item.href;
      }
    }

    // Handle custom click handler
    if (item.onClick) {
      item.onClick();
    }

    // Close sidebar on mobile after navigation (optional, but good UX)
    if (window.innerWidth < 1024 && !('expandable' in item && item.expandable)) {
      onClose();
    }
  };

  const handleLogout = () => {
    localStorage.setItem("hidden", "true");
    window.location.href = "https://is.mendelu.cz/auth/system/logout.pl?lang=cz";
  };

  const mainMenuItems = getMainMenuItems();
  const settingsMenuItems = getSettingsMenuItems(handleLogout);

  return (
    <>
      {/* Backdrop - Visible on all screen sizes when open to allow click-outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-[2000]"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      {isOpen && (
        <aside
          className="fixed top-0 left-0 w-[280px] bg-white border-r border-gray-200 flex flex-col h-screen z-[2001]"
        >
          {/* User Profile Section */}
          <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-primary/5 to-white">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-500">ID: {userId || '...'}</div>
                <div className="text-gray-900 truncate">{userName || ''}</div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Zavřít menu"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 select-none">
            <div className="px-3 mb-2 text-sm font-medium text-gray-500">Navigace</div>

            <ul className="space-y-1">
              {mainMenuItems.map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left relative ${activeItem === item.id
                      ? 'bg-primary/10 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {activeItem === item.id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                    )}
                    <span className={activeItem === item.id ? 'text-primary' : 'text-gray-600'}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.expandable && (
                      expandedItems.includes(item.id)
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {item.expandable && item.children && expandedItems.includes(item.id) && (
                    <ul className="ml-11 mt-1 space-y-1">
                      {item.children.map(child => (
                        <li key={child.id}>
                          <button
                            onClick={() => handleItemClick(child)}
                            className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg transition-all ${activeItem === child.id
                              ? 'text-primary bg-primary/5'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                              }`}
                          >
                            {child.icon && (
                              <span className={activeItem === child.id ? 'text-primary' : 'text-gray-500'}>
                                {child.icon}
                              </span>
                            )}
                            {child.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Settings Section */}
          <div className="border-t border-gray-200 py-2">
            <div className="px-3 mb-2 text-sm font-medium text-gray-500">Nastavení</div>

            <ul className="space-y-1">
              {settingsMenuItems.map(item => (
                <li key={item.id}>
                  <button
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <span className={item.danger ? 'text-red-600' : 'text-gray-600'}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {item.expandable && (
                      expandedItems.includes(item.id)
                        ? <ChevronDown className="w-4 h-4 text-gray-400" />
                        : <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      )}
    </>
  );
}

