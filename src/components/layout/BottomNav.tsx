import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  FolderOpen,
  CheckSquare,
  Settings,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendrier', icon: CalendarDays, label: 'Calendrier' },
  { to: '/dossiers', icon: FolderOpen, label: 'Dossiers' },
  { to: '/taches', icon: CheckSquare, label: 'Tâches' },
  { to: '/parametres', icon: Settings, label: 'Paramètres' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white safe-bottom lg:hidden" aria-label="Navigation principale">
      <div className="flex h-16 items-center justify-around">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1 text-xs transition-colors ${
                isActive ? 'text-primary-600 font-medium' : 'text-slate-500'
              }`
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
