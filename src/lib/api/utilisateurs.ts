import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { Utilisateur, UserRole } from '@/types/database.types';

/** Liste tous les utilisateurs (actifs + archivés) */
export async function getUtilisateurs() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as Utilisateur[];
}

/** Invite un utilisateur (co-hôte ou concierge) via Supabase Auth */
export async function inviteUtilisateur(params: {
  email: string;
  nom: string;
  prenom: string;
  role: Extract<UserRole, 'COHOTE' | 'CONCIERGE'>;
  permissions?: Record<string, boolean>;
}) {
  // Supabase Auth : inviteUserByEmail crée le user + envoie l'email
  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
    params.email,
    {
      data: {
        nom: params.nom,
        prenom: params.prenom,
        role: params.role,
      },
    },
  );

  if (authError) {
    // Fallback : si l'admin API n'est pas disponible côté client,
    // créer l'entrée utilisateurs manuellement avec un mot de passe temporaire
    const tempPassword = crypto.randomUUID().substring(0, 16) + 'A1!';

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: params.email,
      password: tempPassword,
      options: {
        data: {
          nom: params.nom,
          prenom: params.prenom,
          role: params.role,
        },
      },
    });

    if (signUpError) throw signUpError;
    if (!signUpData.user) throw new Error('Erreur lors de la création du compte.');

    // Permissions forcées à {} pour le concierge (mark_paid interdit)
    const permissions = params.role === 'CONCIERGE' ? {} : (params.permissions ?? {});

    const { error: insertError } = await supabase.from('users').insert({
      id: signUpData.user.id,
      email: params.email,
      nom: params.nom,
      prenom: params.prenom,
      role: params.role,
      permissions,
    });

    if (insertError) throw insertError;

    await createAuditLog({
      entity_type: 'utilisateur',
      entity_id: signUpData.user.id,
      action: 'invited',
      metadata: { email: params.email, role: params.role, method: 'signup_fallback' },
    });

    return { userId: signUpData.user.id, tempPassword };
  }

  if (authData.user) {
    const permissions = params.role === 'CONCIERGE' ? {} : (params.permissions ?? {});

    const { error: insertError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: params.email,
      nom: params.nom,
      prenom: params.prenom,
      role: params.role,
      permissions,
    });

    if (insertError) throw insertError;

    await createAuditLog({
      entity_type: 'utilisateur',
      entity_id: authData.user.id,
      action: 'invited',
      metadata: { email: params.email, role: params.role, method: 'invite_email' },
    });
  }

  return { userId: authData.user?.id };
}

/** Alias rétrocompatible pour l'invitation d'un co-hôte */
export async function inviteCoHote(params: {
  email: string;
  nom: string;
  prenom: string;
  permissions?: Record<string, boolean>;
}) {
  return inviteUtilisateur({ ...params, role: 'COHOTE' });
}

/** Met à jour le profil (nom, prénom, email) d'un utilisateur */
export async function updateUtilisateurProfile(
  userId: string,
  updates: { nom?: string; prenom?: string; email?: string },
) {
  if (Object.keys(updates).length === 0) return;

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'utilisateur',
    entity_id: userId,
    action: 'profile_updated',
    metadata: { updated_fields: Object.keys(updates) },
  });
}

/** Change le rôle d'un utilisateur.
 *  Retourne une erreur si l'opération retirerait le dernier admin. */
export async function updateUtilisateurRole(
  userId: string,
  newRole: UserRole,
  currentAdminCount: number,
  targetCurrentRole: UserRole,
) {
  // Garde côté client : empêcher de rétrograder le dernier admin
  if (targetCurrentRole === 'ADMIN' && newRole !== 'ADMIN' && currentAdminCount <= 1) {
    throw new Error(
      'Impossible de changer le rôle du dernier administrateur. Promouvez d\'abord un autre utilisateur en administrateur.',
    );
  }

  // Forcer les permissions à {} pour le concierge
  const permissionsUpdate = newRole === 'CONCIERGE' ? { permissions: {} } : {};

  const { error } = await supabase
    .from('users')
    .update({ role: newRole, ...permissionsUpdate })
    .eq('id', userId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'utilisateur',
    entity_id: userId,
    action: 'role_changed',
    metadata: { from: targetCurrentRole, to: newRole },
  });
}

/** Met à jour les permissions d'un utilisateur.
 *  Ignore silencieusement les permissions interdites au concierge. */
export async function updateUtilisateurPermissions(
  userId: string,
  permissions: Record<string, boolean>,
  userRole?: UserRole,
) {
  // Le concierge ne peut jamais avoir paiement:mark_paid
  const sanitized = { ...permissions };
  if (userRole === 'CONCIERGE') {
    delete sanitized['paiement:mark_paid'];
  }

  const { error } = await supabase
    .from('users')
    .update({ permissions: sanitized })
    .eq('id', userId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'utilisateur',
    entity_id: userId,
    action: 'permissions_updated',
    metadata: { permissions: sanitized },
  });
}

/** Réinitialise le mot de passe d'un utilisateur via Supabase.
 *  Envoie un email de réinitialisation si l'utilisateur a un compte email/password.
 *  Retourne { sent: true } si l'email a été envoyé, ou { sent: false, reason } si
 *  la méthode de connexion est OAuth uniquement. */
export async function resetUtilisateurPassword(
  userEmail: string,
): Promise<{ sent: boolean; reason?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    // Si l'erreur indique que l'utilisateur utilise OAuth,
    // retourner une limitation claire plutôt que de lever une erreur.
    const isOAuthOnly =
      error.message?.toLowerCase().includes('oauth') ||
      error.message?.toLowerCase().includes('provider');

    if (isOAuthOnly) {
      return {
        sent: false,
        reason: 'Cet utilisateur se connecte via un fournisseur OAuth (Google, etc.). La réinitialisation du mot de passe n\'est pas applicable.',
      };
    }
    throw error;
  }

  await createAuditLog({
    entity_type: 'utilisateur',
    entity_id: userEmail,
    action: 'password_reset_requested',
    metadata: { email: userEmail },
  });

  return { sent: true };
}

/** Suspend un utilisateur (retrait d'accès temporaire) */
export async function suspendreUtilisateur(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'utilisateur',
    entity_id: userId,
    action: 'suspended',
  });
}

/** Alias rétrocompatible */
export const archiveUtilisateur = suspendreUtilisateur;

/** Réactive un utilisateur suspendu */
export async function reactiverUtilisateur(userId: string) {
  const { error } = await supabase
    .from('users')
    .update({ archived_at: null })
    .eq('id', userId);

  if (error) throw error;

  await createAuditLog({
    entity_type: 'utilisateur',
    entity_id: userId,
    action: 'reactivated',
  });
}

/** Alias rétrocompatible */
export const reactivateUtilisateur = reactiverUtilisateur;
