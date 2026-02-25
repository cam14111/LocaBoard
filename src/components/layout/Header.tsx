import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { useNotificationSweep } from '@/hooks/useNotificationSweep';
import LogementSelector from './LogementSelector';
import NotificationsPanel from './NotificationsPanel';

export default function Header() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { count: unreadCount, refresh: refreshUnread } = useUnreadNotifications();

  // Sweeps de notifications (options, paiements, arrivées, tâches, EDL)
  useNotificationSweep();

  // Initiales du user
  const initials = profile
    ? `${profile.prenom.charAt(0)}${profile.nom.charAt(0)}`.toUpperCase()
    : '?';

  // Fermer les menus au clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (menuOpen || notifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen, notifOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  function handleNotifToggle() {
    setNotifOpen(!notifOpen);
    setMenuOpen(false);
  }

  function handleNotifClose() {
    setNotifOpen(false);
    refreshUnread();
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-slate-200 bg-white px-4 gap-2 safe-top lg:pl-(--spacing-sidebar)">
      {/* Mobile logo avec tooltip sous-titre */}
      <div className="flex items-center gap-1.5 shrink-0 lg:hidden" title="Votre tableau de bord de gestion locative">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="LocaBoard" className="h-6 w-6" />
        <span className="text-base font-bold">LocaBoard</span>
      </div>

      {/* Sélecteur logement — flex-1 sur mobile (espace disponible), auto sur desktop */}
      <div className="flex-1 min-w-0 lg:flex-none">
        <LogementSelector className="w-full lg:w-auto" />
      </div>

      {/* Spacer desktop pour pousser les actions à droite */}
      <div className="hidden lg:block lg:flex-1" />

      {/* Notifications + avatar */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Cloche notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={handleNotifToggle}
            className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationsPanel onClose={handleNotifClose} />}
        </div>

        {/* Avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }}
            className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700 hover:bg-primary-200 transition-colors"
          >
            {initials}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); navigate('/parametres/profil'); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <User className="h-4 w-4" />
                Mon profil
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
