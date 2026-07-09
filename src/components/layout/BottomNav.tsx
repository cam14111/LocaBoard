import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getNavItems } from './navItems';

export default function BottomNav() {
  const { role } = useAuth();
  const navItems = getNavItems(role);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white safe-bottom lg:hidden" aria-label="Navigation principale">
      <div className="flex h-16 items-center justify-around">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center gap-0.5 px-1 py-1 text-[11px] transition-colors ${
                isActive ? 'text-primary-600 font-medium' : 'text-slate-500'
              }`
            }
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
