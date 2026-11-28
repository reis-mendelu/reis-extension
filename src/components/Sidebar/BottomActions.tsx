import { useRef, useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import { OUTLOOK_ICON_PATH, TEAMS_ICON_PATH } from '../../constants/icons';
import { ProfilePopup } from './ProfilePopup';
import { PersonaPopup } from './PersonaPopup';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { currentSchool } from '../../utils/school';

export function BottomActions() {
  const [isOpen, setOpen] = useState(false);
  // A reIS admin's avatar opens "Zobrazit jako"; "Profil a nastavení" swaps in
  // the profile (decision #16, 2026-11-28). Every close goes back to the list.
  const [onProfile, setOnProfile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();
  const isReisAdmin = useAppStore((s) => s.adminRole === 'reis_admin');
  const personasFirst = isReisAdmin && currentSchool.has('adminConsole') && !onProfile;

  const setIsOpen = (open: boolean) => {
    setOpen(open);
    if (!open) setOnProfile(false);
  };
  const handleEnter = () => {
    if (timeout.current) clearTimeout(timeout.current);
    setIsOpen(true);
  };
  const handleLeave = () => {
    timeout.current = setTimeout(() => setIsOpen(false), 300);
  };

  useEffect(() => {
    if (!isOpen) return;
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setOnProfile(false);
      }
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      setOnProfile(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', esc);
    };
  }, [isOpen]);

  return (
    <div className="flex flex-col gap-2 mb-2 w-full px-2 items-center relative" ref={ref}>
      {currentSchool.has('teamsOutlook') && (
        <>
          <a
            href="https://teams.microsoft.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-12 h-auto py-2 rounded-xl flex flex-col items-center justify-center text-base-content/70 hover:bg-base-100 hover:text-info group"
          >
            <img
              src={TEAMS_ICON_PATH}
              alt="Teams"
              className="w-8 h-8 group-hover:scale-110 transition-transform"
            />
            <span className="text-[10px] mt-1 font-medium">Teams</span>
          </a>
          <a
            href="https://outlook.office.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-12 h-auto py-2 rounded-xl flex flex-col items-center justify-center text-base-content/70 hover:bg-base-100 hover:text-info group"
          >
            <img
              src={OUTLOOK_ICON_PATH}
              alt="Outlook"
              className="w-8 h-8 group-hover:scale-110 transition-transform"
            />
            <span className="text-[10px] mt-1 font-medium">Outlook</span>
          </a>
          <div className="h-px bg-base-content/10 w-full my-1" />
        </>
      )}
      <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        {/* A click opens it too, so the keyboard reaches it; the mouse has
            already opened it by hovering. */}
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={handleEnter}
          className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all ${isOpen ? 'bg-primary text-primary-content shadow-md' : 'text-base-content/70 hover:bg-base-100 hover:text-base-content'}`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-medium">{t('sidebar.profile')}</span>
        </button>
        <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          {isOpen && personasFirst ? (
            <PersonaPopup onClose={() => setIsOpen(false)} onProfile={() => setOnProfile(true)} />
          ) : (
            <ProfilePopup isOpen={isOpen} onClose={() => setIsOpen(false)} />
          )}
        </div>
      </div>
    </div>
  );
}
