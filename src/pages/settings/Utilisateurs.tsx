import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Loader2,
  UserPlus,
  Shield,
  ShieldOff,
  ToggleLeft,
  ToggleRight,
  X,
  Copy,
  Check,
  Pencil,
  KeyRound,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  getUtilisateurs,
  inviteUtilisateur,
  updateUtilisateurProfile,
  updateUtilisateurRole,
  updateUtilisateurPermissions,
  suspendreUtilisateur,
  reactiverUtilisateur,
  resetUtilisateurPassword,
} from '@/lib/api/utilisateurs';
import { markPaidToggleMode } from '@/lib/permissions';
import type { Utilisateur, UserRole } from '@/types/database.types';

// ─── Labels & couleurs ────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  COHOTE: 'Co-hôte',
  CONCIERGE: 'Concierge',
};

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  COHOTE: 'bg-blue-100 text-blue-700',
  CONCIERGE: 'bg-amber-100 text-amber-700',
};

const ROLE_OPTIONS: { value: Extract<UserRole, 'ADMIN' | 'COHOTE' | 'CONCIERGE'>; label: string; description: string }[] = [
  { value: 'ADMIN', label: 'Administrateur', description: 'Accès complet à toutes les fonctions' },
  { value: 'COHOTE', label: 'Co-hôte', description: 'Gestion réservations, dossiers, EDL' },
  { value: 'CONCIERGE', label: 'Concierge', description: 'Tâches assignées, EDL, check-in/check-out uniquement' },
];

// ─── Composant principal ──────────────────────────────────────

export default function UtilisateursPage() {
  const { user: currentUser } = useAuth();
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');

  // Modal invitation
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNom, setInviteNom] = useState('');
  const [invitePrenom, setInvitePrenom] = useState('');
  const [inviteRole, setInviteRole] = useState<Extract<UserRole, 'COHOTE' | 'CONCIERGE'>>('COHOTE');
  const [inviteCanMarkPaid, setInviteCanMarkPaid] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Modal édition profil
  const [editingUser, setEditingUser] = useState<Utilisateur | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editPrenom, setEditPrenom] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('COHOTE');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Réinitialisation mot de passe
  const [resetTarget, setResetTarget] = useState<Utilisateur | null>(null);
  const [resetResult, setResetResult] = useState<{ sent: boolean; reason?: string } | null>(null);
  const [resetting, setResetting] = useState(false);

  const activeAdmins = utilisateurs.filter((u) => u.role === 'ADMIN' && !u.archived_at);

  const loadUtilisateurs = useCallback(async () => {
    try {
      const data = await getUtilisateurs();
      setUtilisateurs(data);
    } catch {
      setUtilisateurs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUtilisateurs();
  }, [loadUtilisateurs]);

  // ─── Invitation ─────────────────────────────────────────────

  async function handleInvite() {
    if (!inviteEmail || !inviteNom || !invitePrenom) {
      setInviteError('Tous les champs sont obligatoires.');
      return;
    }

    setInviting(true);
    setInviteError('');
    setInviteSuccess(null);
    setTempPassword(null);

    try {
      const permissions =
        inviteRole === 'COHOTE' && inviteCanMarkPaid
          ? { 'paiement:mark_paid': true }
          : {};

      const result = await inviteUtilisateur({
        email: inviteEmail,
        nom: inviteNom,
        prenom: invitePrenom,
        role: inviteRole,
        permissions: permissions as Record<string, boolean>,
      });

      if (result.tempPassword) {
        setTempPassword(result.tempPassword);
        setInviteSuccess(
          `Compte créé pour ${invitePrenom} ${inviteNom} (${ROLE_LABELS[inviteRole]}). Communiquez le mot de passe temporaire ci-dessous.`,
        );
      } else {
        setInviteSuccess(`Invitation envoyée à ${inviteEmail}.`);
      }

      setInviteEmail('');
      setInviteNom('');
      setInvitePrenom('');
      setInviteRole('COHOTE');
      setInviteCanMarkPaid(false);
      await loadUtilisateurs();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Erreur lors de l\'invitation.');
    } finally {
      setInviting(false);
    }
  }

  function openInvite() {
    setShowInvite(true);
    setInviteError('');
    setInviteSuccess(null);
    setTempPassword(null);
    setInviteRole('COHOTE');
    setInviteCanMarkPaid(false);
  }

  // ─── Édition profil ─────────────────────────────────────────

  function openEdit(u: Utilisateur) {
    setEditingUser(u);
    setEditNom(u.nom);
    setEditPrenom(u.prenom);
    setEditRole(u.role);
    setEditError('');
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    if (!editNom.trim() || !editPrenom.trim()) {
      setEditError('Tous les champs sont obligatoires.');
      return;
    }

    setSaving(true);
    setEditError('');

    try {
      // Mettre à jour le profil (nom/prénom uniquement — l'email de connexion
      // ne peut être changé que par l'utilisateur lui-même depuis "Mon profil")
      await updateUtilisateurProfile(editingUser.id, {
        nom: editNom.trim(),
        prenom: editPrenom.trim(),
      });

      // Mettre à jour le rôle si changé
      if (editRole !== editingUser.role) {
        await updateUtilisateurRole(
          editingUser.id,
          editRole,
          activeAdmins.length,
          editingUser.role,
        );
      }

      setEditingUser(null);
      await loadUtilisateurs();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Toggle paiement:mark_paid ───────────────────────────────

  async function handleToggleMarkPaid(u: Utilisateur) {
    if (u.role !== 'COHOTE') return;
    const current = u.permissions?.['paiement:mark_paid'] === true;
    setActionError('');
    try {
      await updateUtilisateurPermissions(
        u.id,
        { ...u.permissions, 'paiement:mark_paid': !current },
        u.role,
      );
      await loadUtilisateurs();
    } catch {
      setActionError('Erreur lors de la modification des permissions.');
    }
  }

  // ─── Suspension / réactivation ───────────────────────────────

  async function handleSuspend(u: Utilisateur) {
    if (u.id === currentUser?.id) return;
    // Garde : dernier admin
    if (u.role === 'ADMIN' && activeAdmins.length <= 1) {
      setActionError('Impossible de suspendre le dernier administrateur.');
      return;
    }
    setActionError('');
    try {
      await suspendreUtilisateur(u.id);
      await loadUtilisateurs();
    } catch {
      setActionError('Erreur lors de la suspension.');
    }
  }

  async function handleReactivate(u: Utilisateur) {
    setActionError('');
    try {
      await reactiverUtilisateur(u.id);
      await loadUtilisateurs();
    } catch {
      setActionError('Erreur lors de la réactivation.');
    }
  }

  // ─── Réinitialisation mot de passe ───────────────────────────

  async function handleResetPassword(u: Utilisateur) {
    setResetTarget(u);
    setResetResult(null);
    setResetting(true);
    try {
      const result = await resetUtilisateurPassword(u.email);
      setResetResult(result);
    } catch (err) {
      setResetResult({
        sent: false,
        reason: err instanceof Error ? err.message : 'Erreur inconnue.',
      });
    } finally {
      setResetting(false);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const activeUsers = utilisateurs.filter((u) => !u.archived_at);
  const suspendedUsers = utilisateurs.filter((u) => !!u.archived_at);

  // ─── Rendu ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-600" role="alert">
          {actionError}
        </p>
      )}

      {/* En-tête + bouton inviter */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Utilisateurs ({activeUsers.length})
        </h2>
        <button
          onClick={openInvite}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Inviter
        </button>
      </div>

      {/* Liste utilisateurs actifs */}
      {activeUsers.length === 0 ? (
        <p className="text-sm text-slate-400">Aucun utilisateur.</p>
      ) : (
        <div className="space-y-2">
          {activeUsers.map((u) => {
            const isSelf = u.id === currentUser?.id;
            const toggleMode = markPaidToggleMode(u.role);
            const canMarkPaid = u.permissions?.['paiement:mark_paid'] === true;
            const isLastAdmin = u.role === 'ADMIN' && activeAdmins.length <= 1;

            return (
              <div
                key={u.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {u.prenom} {u.nom}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-slate-400">(vous)</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                    <button
                      onClick={() => openEdit(u)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label={`Modifier ${u.prenom} ${u.nom}`}
                      title="Modifier le profil"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Ligne permissions + actions */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  {/* Peut marquer payé */}
                  <div className="flex items-center gap-2">
                    {toggleMode === 'always' && (
                      <span className="text-xs text-slate-400 italic">
                        Peut marquer payé (toujours)
                      </span>
                    )}
                    {toggleMode === 'toggle' && (
                      <>
                        <button
                          onClick={() => handleToggleMarkPaid(u)}
                          className="text-slate-500 hover:text-primary-600"
                          aria-label={
                            canMarkPaid
                              ? 'Désactiver : peut marquer payé'
                              : 'Activer : peut marquer payé'
                          }
                        >
                          {canMarkPaid ? (
                            <ToggleRight className="h-5 w-5 text-primary-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                        </button>
                        <span className="text-xs text-slate-600">Peut marquer payé</span>
                      </>
                    )}
                    {toggleMode === 'never' && (
                      <span className="text-xs text-slate-400 italic">
                        Marquage payé interdit
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleResetPassword(u)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                      title="Réinitialiser le mot de passe"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Mot de passe</span>
                    </button>

                    {!isSelf && (
                      <button
                        onClick={() => handleSuspend(u)}
                        disabled={isLastAdmin}
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        title={isLastAdmin ? 'Dernier administrateur — impossible de suspendre' : 'Suspendre l\'accès'}
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Suspendre</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Utilisateurs suspendus */}
      {suspendedUsers.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-medium text-slate-400 mb-2">
            Accès suspendus ({suspendedUsers.length})
          </h3>
          <div className="space-y-2">
            {suspendedUsers.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-slate-500 line-through">
                    {u.prenom} {u.nom}
                  </p>
                  <p className="text-xs text-slate-400">{u.email}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium opacity-60 ${ROLE_COLORS[u.role]}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>
                <button
                  onClick={() => handleReactivate(u)}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Réactiver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modal édition profil ─────────────────────────────── */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setEditingUser(null)}
          role="presentation"
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ui-edit-title"
          >
            <div className="flex items-center justify-between">
              <h3 id="ui-edit-title" className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary-600" aria-hidden="true" />
                Modifier le profil
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-prenom" className="block text-xs text-slate-600 mb-1">Prénom</label>
                <input
                  id="edit-prenom"
                  type="text"
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="edit-nom" className="block text-xs text-slate-600 mb-1">Nom</label>
                <input
                  id="edit-nom"
                  type="text"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-role" className="block text-xs text-slate-600 mb-1">Rôle</label>
              <div className="relative">
                <select
                  id="edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  disabled={
                    // Impossible de changer son propre rôle
                    editingUser.id === currentUser?.id
                    // Impossible de rétrograder le dernier admin
                    || (editingUser.role === 'ADMIN' && activeAdmins.length <= 1)
                  }
                  className="w-full appearance-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} — {opt.description}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              </div>
              {editingUser.id === currentUser?.id && (
                <p className="mt-1 text-xs text-slate-400">Vous ne pouvez pas modifier votre propre rôle.</p>
              )}
              {editingUser.role === 'ADMIN' && activeAdmins.length <= 1 && editingUser.id !== currentUser?.id && (
                <p className="mt-1 text-xs text-amber-600">Dernier administrateur — le rôle ne peut pas être changé.</p>
              )}
            </div>

            {editError && (
              <p className="text-xs text-red-600" role="alert">{editError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal reset mot de passe ────────────────────────── */}
      {resetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => { setResetTarget(null); setResetResult(null); }}
          role="presentation"
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ui-reset-title"
          >
            <div className="flex items-center justify-between">
              <h3 id="ui-reset-title" className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary-600" aria-hidden="true" />
                Réinitialiser le mot de passe
              </h3>
              <button
                onClick={() => { setResetTarget(null); setResetResult(null); }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {resetting && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi en cours…
              </div>
            )}

            {resetResult && !resetting && (
              resetResult.sent ? (
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                  Un email de réinitialisation a été envoyé à <strong>{resetTarget.email}</strong>.
                  L'utilisateur pourra choisir un nouveau mot de passe via le lien reçu.
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                  <p className="font-medium mb-1">Réinitialisation non disponible</p>
                  <p>{resetResult.reason}</p>
                </div>
              )
            )}

            {!resetResult && !resetting && (
              <p className="text-sm text-slate-600">
                Un email de réinitialisation du mot de passe sera envoyé à{' '}
                <strong>{resetTarget.email}</strong>.
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setResetTarget(null); setResetResult(null); }}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Fermer
              </button>
              {!resetResult && !resetting && (
                <button
                  onClick={() => handleResetPassword(resetTarget)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                >
                  <KeyRound className="h-4 w-4" />
                  Envoyer l'email
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal invitation ────────────────────────────────── */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setShowInvite(false)}
          role="presentation"
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ui-invite-title"
          >
            <div className="flex items-center justify-between">
              <h3 id="ui-invite-title" className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary-600" aria-hidden="true" />
                Inviter un utilisateur
              </h3>
              <button
                onClick={() => setShowInvite(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {inviteSuccess ? (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
                <p>{inviteSuccess}</p>
                {tempPassword && (
                  <div className="mt-2 flex items-center gap-2 rounded bg-white border border-green-200 px-3 py-2">
                    <code className="flex-1 text-xs font-mono">{tempPassword}</code>
                    <button
                      onClick={() => copyToClipboard(tempPassword)}
                      className="text-green-600 hover:text-green-800"
                      aria-label="Copier le mot de passe temporaire"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ui-prenom" className="block text-xs text-slate-600 mb-1">Prénom</label>
                    <input
                      id="ui-prenom"
                      type="text"
                      value={invitePrenom}
                      onChange={(e) => setInvitePrenom(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                      placeholder="Jean"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label htmlFor="ui-nom" className="block text-xs text-slate-600 mb-1">Nom</label>
                    <input
                      id="ui-nom"
                      type="text"
                      value={inviteNom}
                      onChange={(e) => setInviteNom(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                      placeholder="Dupont"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="ui-email" className="block text-xs text-slate-600 mb-1">Email</label>
                  <input
                    id="ui-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                    placeholder="utilisateur@example.com"
                  />
                </div>

                {/* Sélecteur de rôle */}
                <div>
                  <p className="text-xs text-slate-600 mb-2">Rôle</p>
                  <div className="space-y-2">
                    {ROLE_OPTIONS.filter((o) => o.value !== 'ADMIN').map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          inviteRole === opt.value
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="invite-role"
                          value={opt.value}
                          checked={inviteRole === opt.value}
                          onChange={() => {
                            setInviteRole(opt.value as Extract<UserRole, 'COHOTE' | 'CONCIERGE'>);
                            if (opt.value === 'CONCIERGE') setInviteCanMarkPaid(false);
                          }}
                          className="mt-0.5 text-primary-600"
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{opt.label}</p>
                          <p className="text-xs text-slate-500">{opt.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Toggle paiement:mark_paid (co-hôte seulement) */}
                {inviteRole === 'COHOTE' && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInviteCanMarkPaid(!inviteCanMarkPaid)}
                      className="text-slate-500"
                      aria-label={inviteCanMarkPaid ? 'Désactiver marquer payé' : 'Activer marquer payé'}
                    >
                      {inviteCanMarkPaid ? (
                        <ToggleRight className="h-5 w-5 text-primary-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <span className="text-sm text-slate-600">Peut marquer les paiements comme payés</span>
                  </div>
                )}

                {inviteError && (
                  <p className="text-xs text-red-600" role="alert">{inviteError}</p>
                )}

                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Inviter
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
