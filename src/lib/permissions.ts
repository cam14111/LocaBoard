import type { UserRole } from '@/types/database.types';

export type Permission =
  | 'reservation:create'
  | 'reservation:edit'
  | 'reservation:cancel'
  | 'dossier:view'
  | 'dossier:advance'
  | 'paiement:mark_paid'
  | 'edl:create'
  | 'edl:edit'
  | 'document:upload_all'
  | 'document:replace'
  | 'tache:create'
  | 'tache:assign'
  | 'tache:complete'
  | 'logement:create'
  | 'logement:edit'
  | 'logement:archive'
  | 'checklist:manage'
  | 'utilisateur:manage'
  | 'settings:manage';

// Permissions de base accordées au co-hôte
const COHOTE_PERMISSIONS = new Set<Permission>([
  'reservation:create',
  'reservation:edit',
  'dossier:view',
  'dossier:advance',
  'edl:create',
  'edl:edit',
  'tache:complete',
]);

// Permissions de base accordées au concierge
// Le concierge peut exécuter ses tâches et faire les EDL/check-in/check-out.
// Il n'a PAS accès à la gestion (logements, utilisateurs, paiements, réservations).
const CONCIERGE_PERMISSIONS = new Set<Permission>([
  'dossier:view',
  'edl:create',
  'edl:edit',
  'tache:complete',
]);

// Permissions qui nécessitent une activation explicite par l'admin
// (uniquement pour le co-hôte — le concierge ne peut jamais les obtenir)
const EXPLICIT_PERMISSIONS = new Set<Permission>([
  'paiement:mark_paid',
]);

export function hasPermission(
  role: UserRole | null,
  permission: Permission,
  userPermissions?: Record<string, boolean>,
): boolean {
  if (!role) return false;

  // Admin a toutes les permissions
  if (role === 'ADMIN') return true;

  // Concierge : permissions fixes, paiement:mark_paid toujours refusé
  if (role === 'CONCIERGE') {
    if (EXPLICIT_PERMISSIONS.has(permission)) return false;
    return CONCIERGE_PERMISSIONS.has(permission);
  }

  // Co-hôte — permissions explicites (activées par l'admin)
  if (EXPLICIT_PERMISSIONS.has(permission)) {
    return userPermissions?.[permission] === true;
  }

  // Permissions de base du co-hôte
  return COHOTE_PERMISSIONS.has(permission);
}

/**
 * Indique si le toggle "peut marquer payé" doit être affiché/éditable
 * selon le rôle :
 *   - ADMIN      : pas de toggle (toujours autorisé)
 *   - COHOTE     : toggle modifiable par l'admin
 *   - CONCIERGE  : pas de toggle (toujours interdit)
 */
export function markPaidToggleMode(role: UserRole): 'always' | 'toggle' | 'never' {
  if (role === 'ADMIN') return 'always';
  if (role === 'COHOTE') return 'toggle';
  return 'never';
}
