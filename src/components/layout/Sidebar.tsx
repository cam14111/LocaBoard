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

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-(--spacing-sidebar) flex-col border-r border-slate-200 bg-white lg:flex">
      {/* Logo */}
      <div className="flex min-h-16 items-center gap-2.5 border-b border-slate-100 px-5 py-3">
        <img src="/logo.png" alt="LocaBoard" className="h-20 w-20 shrink-0" />
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-900 leading-tight">LocaBoard</p>
          <p className="text-[10px] text-slate-400 leading-tight">
            Votre tableau de bord<br />de gestion locative
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
