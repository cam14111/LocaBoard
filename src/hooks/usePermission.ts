import { useAuth } from '@/hooks/useAuth';
import { hasPermission, type Permission } from '@/lib/permissions';

export function usePermission(permission: Permission): boolean {
  const { role, profile } = useAuth();
  if (!role || !profile) return false;
  return hasPermission(role, permission, profile.permissions);
}
