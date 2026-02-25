import { Link } from 'react-router-dom';
import { Home, User, Users, ScrollText, ChevronRight } from 'lucide-react';
import PermissionGate from '@/components/ui/PermissionGate';

const menuItems = [
  { to: '/parametres/logements', label: 'Logements', icon: Home, adminOnly: false },
  { to: '/parametres/profil', label: 'Mon profil', icon: User, adminOnly: false },
  { to: '/parametres/utilisateurs', label: 'Utilisateurs', icon: Users, adminOnly: true },
  { to: '/parametres/audit-log', label: 'Journal d\'audit', icon: ScrollText, adminOnly: true },
];

export default function SettingsIndex() {
  return (
    <div className="space-y-3">
      {menuItems.map((item) => {
        const card = (
          <Link
            key={item.to}
            to={item.to}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between hover:border-primary-200 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5 text-slate-500" />
              <span className="font-medium">{item.label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </Link>
        );

        if (item.adminOnly) {
          return (
            <PermissionGate key={item.to} permission="settings:manage">
              {card}
            </PermissionGate>
          );
        }

        return card;
      })}
    </div>
  );
}
