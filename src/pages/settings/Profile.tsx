import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { updateUtilisateurProfile, uploadSignature, deleteSignature } from '@/lib/api/utilisateurs';
import { createAuditLog } from '@/lib/api/audit';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { ArrowLeft, Bell, BellOff, Check, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  COHOTE: 'Co-hôte',
  CONCIERGE: 'Concierge',
};

export default function Profile() {
  const { profile, user, refreshProfile } = useAuth();

  // ── Édition des infos ────────────────────────────────────────
  const [editingInfo, setEditingInfo] = useState(false);
  const [editPrenom, setEditPrenom] = useState('');
  const [editNom, setEditNom] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAdresse, setEditAdresse] = useState('');
  const [editSiret, setEditSiret] = useState('');
  const [editTelephone, setEditTelephone] = useState('');
  const [editVille, setEditVille] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState('');
  const [infoSuccess, setInfoSuccess] = useState('');

  // ── Signature bailleur ─────────────────────────────────────
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureCurrentUrl, setSignatureCurrentUrl] = useState<string | null>(null);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [deletingSignature, setDeletingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState('');
  const [signatureSuccess, setSignatureSuccess] = useState('');

  const loadSignaturePreview = useCallback(async () => {
    const storagePath = profile?.signature_url;
    if (!storagePath) { setSignatureCurrentUrl(null); return; }
    try {
      const { data } = await supabase.storage.from('documents').createSignedUrl(storagePath, 3600);
      if (data?.signedUrl) setSignatureCurrentUrl(data.signedUrl);
    } catch {
      setSignatureCurrentUrl(null);
    }
  }, [profile?.signature_url]);

  useEffect(() => { loadSignaturePreview(); }, [loadSignaturePreview]);

  function openEditInfo() {
    setEditPrenom(profile?.prenom ?? '');
    setEditNom(profile?.nom ?? '');
    setEditEmail(user?.email ?? '');
    setEditAdresse((profile as { adresse?: string | null })?.adresse ?? '');
    setEditSiret((profile as { siret?: string | null })?.siret ?? '');
    setEditTelephone((profile as { telephone?: string | null })?.telephone ?? '');
    setEditVille(profile?.ville ?? '');
    setInfoError('');
    setInfoSuccess('');
    setEditingInfo(true);
  }

  async function handleSaveInfo(e: FormEvent) {
    e.preventDefault();
    setInfoError('');
    setInfoSuccess('');

    if (!editPrenom.trim() || !editNom.trim() || !editEmail.trim()) {
      setInfoError('Tous les champs sont obligatoires.');
      return;
    }

    if (editSiret.trim() && !/^\d{14}$/.test(editSiret.trim())) {
      setInfoError('Le numéro SIRET doit comporter exactement 14 chiffres.');
      return;
    }

    setSavingInfo(true);
    try {
      const emailChanged = editEmail.trim() !== user?.email;
      const profileData = profile as { adresse?: string | null; siret?: string | null } | null;

      // 1. Mettre à jour nom/prénom/adresse/siret dans la table users
      const profileUpdates: { nom?: string; prenom?: string; adresse?: string; siret?: string; telephone?: string; ville?: string } = {};
      if (editNom.trim() !== profile?.nom) profileUpdates.nom = editNom.trim();
      if (editPrenom.trim() !== profile?.prenom) profileUpdates.prenom = editPrenom.trim();
      if (editAdresse.trim() !== (profileData?.adresse ?? '')) profileUpdates.adresse = editAdresse.trim();
      if (editSiret.trim() !== (profileData?.siret ?? '')) profileUpdates.siret = editSiret.trim() || '';
      if (editTelephone.trim() !== ((profile as { telephone?: string | null })?.telephone ?? '')) profileUpdates.telephone = editTelephone.trim() || '';
      if (editVille.trim() !== (profile?.ville ?? '')) profileUpdates.ville = editVille.trim();
      if (Object.keys(profileUpdates).length > 0) {
        await updateUtilisateurProfile(user!.id, profileUpdates);
      }

      // 2. Changer l'email via l'Edge Function (admin API côté serveur)
      //    → modifie auth.users ET la table users en une seule opération
      if (emailChanged) {
        const { data, error: fnError } = await supabase.functions.invoke(
          'update-own-email',
          { body: { newEmail: editEmail.trim() } },
        );

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error as string);

        await createAuditLog({
          entity_type: 'utilisateur',
          entity_id: user!.id,
          action: 'own_email_changed',
          metadata: { newEmail: editEmail.trim() },
        });
      }

      setInfoSuccess('Profil mis à jour avec succès.');
      await refreshProfile();
      setEditingInfo(false);
    } catch (err) {
      setInfoError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.');
    } finally {
      setSavingInfo(false);
    }
  }

  // ── Changement de mot de passe ───────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? '',
        password: currentPassword,
      });

      if (signInError) {
        setError('Mot de passe actuel incorrect.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError('Erreur lors de la mise à jour du mot de passe.');
        return;
      }

      setSuccess('Mot de passe mis à jour avec succès.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setError('Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  // ── Push Notifications ───────────────────────────────────────
  const { permission, isSubscribed, isLoading: pushLoading, subscribe, unsubscribe } = usePushNotifications();
  const [pushError, setPushError] = useState('');

  async function handleTogglePush() {
    setPushError('');
    if (isSubscribed) {
      await unsubscribe();
    } else {
      const ok = await subscribe();
      if (!ok && permission === 'denied') {
        setPushError('Permission refusée. Autorisez les notifications dans les paramètres de votre navigateur.');
      }
    }
  }

  // ── Rendu ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Link to="/parametres" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Link>

      {/* Informations du profil */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Informations</h2>
          {!editingInfo && (
            <button
              onClick={openEditInfo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          )}
        </div>

        {infoSuccess && !editingInfo && (
          <p className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2" role="status">
            <Check className="h-4 w-4 flex-shrink-0" />
            {infoSuccess}
          </p>
        )}

        {editingInfo ? (
          <form onSubmit={handleSaveInfo} className="space-y-4 max-w-md">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="profile-prenom" className="block text-sm font-medium text-slate-700 mb-1">
                  Prénom
                </label>
                <input
                  id="profile-prenom"
                  type="text"
                  required
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="profile-nom" className="block text-sm font-medium text-slate-700 mb-1">
                  Nom
                </label>
                <input
                  id="profile-nom"
                  type="text"
                  required
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700 mb-1">
                Adresse email
              </label>
              <input
                id="profile-email"
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">
                Le changement est immédiat. Notez la nouvelle adresse avant d'enregistrer.
              </p>
            </div>

            <div>
              <label htmlFor="profile-adresse" className="block text-sm font-medium text-slate-700 mb-1">
                Adresse postale (bailleur)
              </label>
              <AddressAutocomplete
                id="profile-adresse"
                value={editAdresse}
                onChange={setEditAdresse}
                pays="France"
                placeholder="Rechercher une adresse…"
              />
            </div>

            <div>
              <label htmlFor="profile-ville" className="block text-sm font-medium text-slate-700 mb-1">
                Ville <span className="text-slate-400 font-normal">(pour les contrats)</span>
              </label>
              <input
                id="profile-ville"
                type="text"
                value={editVille}
                onChange={(e) => setEditVille(e.target.value)}
                placeholder="ex : Lyon"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="profile-telephone" className="block text-sm font-medium text-slate-700 mb-1">
                Téléphone <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <input
                id="profile-telephone"
                type="tel"
                value={editTelephone}
                onChange={(e) => setEditTelephone(e.target.value)}
                placeholder="ex : 06 12 34 56 78"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="profile-siret" className="block text-sm font-medium text-slate-700 mb-1">
                SIRET <span className="text-slate-400 font-normal">(optionnel)</span>
              </label>
              <input
                id="profile-siret"
                type="text"
                inputMode="numeric"
                pattern="\d{14}"
                maxLength={14}
                value={editSiret}
                onChange={(e) => setEditSiret(e.target.value.replace(/\D/g, ''))}
                placeholder="14 chiffres"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            {infoError && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">{infoError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingInfo(false)}
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
              >
                <X className="h-4 w-4" />
                Annuler
              </button>
              <button
                type="submit"
                disabled={savingInfo}
                className="flex-1 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Enregistrer
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Prénom</p>
              <p className="font-medium">{profile?.prenom ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Nom</p>
              <p className="font-medium">{profile?.nom ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="font-medium">{user?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Rôle</p>
              <p className="font-medium">{ROLE_LABELS[profile?.role ?? ''] ?? profile?.role ?? '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm text-slate-500">Adresse postale</p>
              <p className="font-medium">{(profile as { adresse?: string | null })?.adresse || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Téléphone</p>
              <p className="font-medium">{(profile as { telephone?: string | null })?.telephone || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">SIRET</p>
              <p className="font-medium">{(profile as { siret?: string | null })?.siret || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Ville</p>
              <p className="font-medium">{profile?.ville || '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Signature du bailleur */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Signature du bailleur</h2>
        <p className="text-sm text-slate-500 mb-4">
          Votre signature sera automatiquement apposée sur les contrats générés.
        </p>

        {signatureCurrentUrl && !signaturePreview && (
          <img src={signatureCurrentUrl} alt="Signature actuelle" className="max-h-24 border border-slate-200 rounded-lg p-2 mb-3 bg-white" />
        )}

        {signaturePreview && (
          <img src={signaturePreview} alt="Aperçu signature" className="max-h-24 border border-slate-200 rounded-lg p-2 mb-3 bg-white" />
        )}

        {signatureError && (
          <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">{signatureError}</p>
        )}

        {signatureSuccess && (
          <p className="mb-3 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2" role="status">
            <Check className="h-4 w-4 flex-shrink-0" />
            {signatureSuccess}
          </p>
        )}

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
            <Upload className="h-4 w-4" />
            {profile?.signature_url ? 'Remplacer' : 'Charger une signature'}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSignatureError('');
                setSignatureSuccess('');
                if (file.size > 2 * 1024 * 1024) {
                  setSignatureError('Le fichier ne doit pas dépasser 2 Mo.');
                  return;
                }
                setSignatureFile(file);
                setSignaturePreview(URL.createObjectURL(file));
              }}
            />
          </label>

          {signatureFile && (
            <button
              type="button"
              onClick={async () => {
                if (!user) return;
                setUploadingSignature(true);
                setSignatureError('');
                try {
                  await uploadSignature(user.id, signatureFile);
                  await refreshProfile();
                  setSignatureFile(null);
                  if (signaturePreview) URL.revokeObjectURL(signaturePreview);
                  setSignaturePreview(null);
                  setSignatureSuccess('Signature enregistrée.');
                  await loadSignaturePreview();
                } catch (err) {
                  setSignatureError(err instanceof Error ? err.message : 'Erreur lors de l\'upload.');
                } finally {
                  setUploadingSignature(false);
                }
              }}
              disabled={uploadingSignature}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {uploadingSignature ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Enregistrer
            </button>
          )}

          {profile?.signature_url && !signatureFile && (
            <button
              type="button"
              onClick={async () => {
                if (!user || !profile?.signature_url) return;
                setDeletingSignature(true);
                setSignatureError('');
                try {
                  await deleteSignature(user.id, profile.signature_url);
                  await refreshProfile();
                  setSignatureCurrentUrl(null);
                  setSignatureSuccess('Signature supprimée.');
                } catch (err) {
                  setSignatureError(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
                } finally {
                  setDeletingSignature(false);
                }
              }}
              disabled={deletingSignature}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deletingSignature ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Notifications push */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-1">Notifications push</h2>
        <p className="text-sm text-slate-500 mb-4">
          Recevez une notification sur cet appareil lorsqu'une tâche vous est assignée, même si l'application est fermée.
        </p>

        {permission === 'unsupported' ? (
          <p className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-500">
            Votre navigateur ne supporte pas les notifications push.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={handleTogglePush}
              disabled={pushLoading || permission === 'denied'}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                isSubscribed
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {pushLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSubscribed ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              {isSubscribed ? 'Désactiver' : 'Activer'}
            </button>
            <span className={`text-sm ${isSubscribed ? 'text-emerald-600' : 'text-slate-400'}`}>
              {isSubscribed ? 'Actives sur cet appareil' : 'Inactives'}
            </span>
          </div>
        )}

        {permission === 'denied' && !isSubscribed && (
          <p className="mt-3 text-xs text-amber-600">
            Les notifications sont bloquées par le navigateur. Autorisez-les dans les paramètres de votre navigateur puis rechargez la page.
          </p>
        )}

        {pushError && (
          <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
            {pushError}
          </p>
        )}
      </div>

      {/* Changement de mot de passe */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Changer le mot de passe</h2>
        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
              Mot de passe actuel
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
              Nouveau mot de passe
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-400">Minimum 8 caractères</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
              Confirmer le nouveau mot de passe
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">{error}</p>}
          {success && (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-600 flex items-center gap-2" role="status">
              <Check className="h-4 w-4" /> {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Mettre à jour
          </button>
        </form>
      </div>
    </div>
  );
}
