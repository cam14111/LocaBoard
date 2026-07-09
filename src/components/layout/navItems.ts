import {
  LayoutDashboard,
  CalendarDays,
  FolderOpen,
  CheckSquare,
  CreditCard,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/database.types';

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  /** Rôles autorisés à voir l'entrée (tous si absent) */
  roles?: UserRole[];
}

const allNavItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendrier', icon: CalendarDays, label: 'Calendrier' },
  { to: '/dossiers', icon: FolderOpen, label: 'Dossiers' },
  { to: '/taches', icon: CheckSquare, label: 'Tâches' },
  { to: '/paiements', icon: CreditCard, label: 'Paiements', roles: ['ADMIN', 'COHOTE'] },
  { to: '/parametres', icon: Settings, label: 'Paramètres' },
];

export function getNavItems(role: UserRole | null): NavItem[] {
  return allNavItems.filter((item) => !item.roles || (role !== null && item.roles.includes(role)));
}
