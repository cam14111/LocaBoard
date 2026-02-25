import type { ReactNode } from 'react';
import { usePermission } from '@/hooks/usePermission';
import type { Permission } from '@/lib/permissions';

interface Props {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
  mode?: 'hide' | 'disable';
}

export default function PermissionGate({ permission, children, fallback, mode = 'hide' }: Props) {
  const allowed = usePermission(permission);

  if (allowed) return <>{children}</>;

  if (mode === 'disable') {
    return (
      <div className="pointer-events-none opacity-50" aria-disabled="true">
        {children}
      </div>
    );
  }

  return fallback ? <>{fallback}</> : null;
}
