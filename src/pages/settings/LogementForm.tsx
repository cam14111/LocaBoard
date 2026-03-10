import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save, Plus, Trash2, ChevronUp, ChevronDown, RotateCcw, Info } from 'lucide-react';
import { createLogement, getLogementById, updateLogement } from '@/lib/api/logements';
import { getLogementPieces, upsertLogementPieces, generateDefaultPieces, adjustPiecesForCount } from '@/lib/api/logementPieces';
import { getLogementSaisons, upsertLogementSaisons } from '@/lib/api/logementSaisons';
import { getActiveUtilisateurs, getLogementAccess, setLogementAccess } from '@/lib/api/utilisateurs';
import { getDefaultSaisons, validateSaisons, computeHauteSaisonPeriods, SAISON_BASSE, SAISON_HAUTE, SAISON_TRES_HAUTE } from '@/lib/saisonUtils';
import type { SaisonConfig } from '@/lib/saisonUtils';
import type { TypePiece, Utilisateur } from '@/types/database.types';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import { useAuth } from '@/hooks/useAuth';
import { useSelectedLogement } from '@/hooks/useSelectedLogement';

// ─── Constantes ───────────────────────────────────────────────

const LOGEMENT_TYPES = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison', label: 'Maison' },
  { value: 'studio', label: 'Studio' },
  { value: 'chambre', label: 'Chambre' },
  { value: 'autre', label: 'Autre' },
];

const ANIMAUX_TAILLE_OPTIONS = [
  { value: '', label: '— Non précisé —' },
  { value: 'petit', label: 'Petit (< 10 kg)' },
  { value: 'moyen', label: 'Moyen (10-25 kg)' },
  { value: 'grand', label: 'Grand (> 25 kg)' },
];

type TabId = 'general' | 'pieces' | 'tarifs' | 'acces';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'general', label: 'Général' },
  { id: 'pieces', label: 'Pièces EDL' },
  { id: 'tarifs', label: 'Tarifs' },
  { id: 'acces', label: 'Accès' },
];

const INPUT_CLASS = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none';

// ─── Types formulaire ─────────────────────────────────────────

interface FormData {
  nom: string;
  adresse: string;
  type: string;
  surface_m2: string;
  capacite_personnes: string;
  nb_pieces: string;
  nb_chambres: string;
  nb_salles_de_bain: string;
  heure_checkin: string;
  heure_checkout: string;
  buffer_heures: string;
  taux_taxe_sejour: string;
  duree_expiration_option_jours: string;
  taches_auto_enabled: boolean;
  description: string;
  equipements: string;
  forfait_menage_eur: string;
  charges_incluses: string;
  animaux_autorises: boolean;
  animaux_types: string;
  animaux_nb_max: string;
  animaux_taille_max: string;
  loyer_nuit_defaut: string;
  loyer_semaine_defaut: string;
}

interface PieceRow {
  nom: string;
  type_piece: TypePiece;
  ordre: number;
}

const INITIAL: FormData = {
  nom: '',
  adresse: '',
  type: 'appartement',
  surface_m2: '',
  capacite_personnes: '',
  nb_pieces: '',
  nb_chambres: '0',
  nb_salles_de_bain: '0',
  heure_checkin: '15:00',
  heure_checkout: '10:00',
  buffer_heures: '4',
  taux_taxe_sejour: '0',
  duree_expiration_option_jours: '3',
  taches_auto_enabled: true,
  description: '',
  equipements: '',
  forfait_menage_eur: '',
  charges_incluses: '',
  animaux_autorises: false,
  animaux_types: '',
  animaux_nb_max: '',
  animaux_taille_max: '',
  loyer_nuit_defaut: '',
  loyer_semaine_defaut: '',
};

// ─── Composant Toggle ─────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
          checked ? 'bg-primary-600' : 'bg-slate-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
}

// ─── Formattage MM-DD → lisible ───────────────────────────────

function formatMMDD(mmdd: string): string {
  if (!mmdd || mmdd.length !== 5) return '—';
  const [m, d] = mmdd.split('-').map(Number);
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  return `${d} ${months[m - 1] ?? '?'}`;
}

// ─── Composant principal ──────────────────────────────────────

export default function LogementForm() {
  const { id } = useParams();
  const isEdit = id !== undefined && id !== 'nouveau';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshLogements } = useSelectedLogement();

  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [form, setForm] = useState<FormData>(INITIAL);
  const [pieces, setPieces] = useState<PieceRow[]>([]);
  const [piecesLoaded, setPiecesLoaded] = useState(false);
  const [saisonsEnabled, setSaisonsEnabled] = useState(false);
  const [saisons, setSaisons] = useState<SaisonConfig[]>([]);
  const [saisonsLoaded, setSaisonsLoaded] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Utilisateur[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // ─── Chargement initial ──────────────────────────────────

  useEffect(() => {
    if (!isEdit) return;
    getLogementById(id!)
      .then((logement) => {
        setForm({
          nom: logement.nom,
          adresse: logement.adresse,
          type: logement.type,
          surface_m2: logement.surface_m2?.toString() ?? '',
          capacite_personnes: logement.capacite_personnes.toString(),
          nb_pieces: logement.nb_pieces?.toString() ?? '',
          nb_chambres: logement.nb_chambres.toString(),
          nb_salles_de_bain: logement.nb_salles_de_bain.toString(),
          heure_checkin: logement.heure_checkin.slice(0, 5),
          heure_checkout: logement.heure_checkout.slice(0, 5),
          buffer_heures: logement.buffer_heures.toString(),
          taux_taxe_sejour: logement.taux_taxe_sejour.toString(),
          duree_expiration_option_jours: logement.duree_expiration_option_jours.toString(),
          taches_auto_enabled: logement.taches_auto_enabled,
          description: logement.description ?? '',
          equipements: logement.equipements ?? '',
          forfait_menage_eur: logement.forfait_menage_eur?.toString() ?? '',
          charges_incluses: logement.charges_incluses ?? '',
          animaux_autorises: logement.animaux_autorises ?? false,
          animaux_types: logement.animaux_types ?? '',
          animaux_nb_max: logement.animaux_nb_max?.toString() ?? '',
          animaux_taille_max: logement.animaux_taille_max ?? '',
          loyer_nuit_defaut: logement.loyer_nuit_defaut?.toString() ?? '',
          loyer_semaine_defaut: logement.loyer_semaine_defaut?.toString() ?? '',
        });
      })
      .catch(() => setError('Impossible de charger le logement.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Chargement des utilisateurs actifs non-admin au montage
  useEffect(() => {
    getActiveUtilisateurs()
      .then((users) => setActiveUsers(users.filter((u) => u.role !== 'ADMIN' && u.id !== user?.id)))
      .catch(() => { /* silencieux */ });

    // Pour une création, l'onglet Accès est vide par défaut (aucun accès pré-coché)
    if (!isEdit) setAccessLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chargement lazy des accès logement (onglet Accès, mode édition uniquement)
  const loadAccess = useCallback(async () => {
    if (!isEdit || accessLoaded) return;
    try {
      const ids = await getLogementAccess(id!);
      setSelectedUserIds(ids);
    } catch {
      // Silencieux
    } finally {
      setAccessLoaded(true);
    }
  }, [id, isEdit, accessLoaded]);

  // Chargement lazy des pièces
  const loadPieces = useCallback(async () => {
    if (!isEdit || piecesLoaded) return;
    try {
      const data = await getLogementPieces(id!);
      setPieces(data.map((p) => ({ nom: p.nom, type_piece: p.type_piece, ordre: p.ordre })));
    } catch {
      // Silencieux
    } finally {
      setPiecesLoaded(true);
    }
  }, [id, isEdit, piecesLoaded]);

  // Chargement lazy des saisons
  const loadSaisons = useCallback(async () => {
    if (!isEdit || saisonsLoaded) return;
    try {
      const data = await getLogementSaisons(id!);
      if (data.length > 0) {
        setSaisonsEnabled(true);
        setSaisons(data.map((s) => ({
          nom_saison: s.nom_saison,
          loyer_nuit: s.loyer_nuit,
          loyer_semaine: s.loyer_semaine,
          date_debut: s.date_debut,
          date_fin: s.date_fin,
          ordre: s.ordre,
        })));
      }
    } catch {
      // Silencieux
    } finally {
      setSaisonsLoaded(true);
    }
  }, [id, isEdit, saisonsLoaded]);

  useEffect(() => {
    if (activeTab === 'pieces') loadPieces();
    if (activeTab === 'tarifs') loadSaisons();
    if (activeTab === 'acces') loadAccess();
  }, [activeTab, loadPieces, loadSaisons, loadAccess]);

  // ─── Handlers formulaire ─────────────────────────────────

  function handleChange(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ─── Handlers pièces ─────────────────────────────────────

  function handleNbChange(field: 'nb_chambres' | 'nb_salles_de_bain', rawValue: string) {
    const newCount = Math.max(0, Number(rawValue) || 0);
    const oldCount = Number(form[field]) || 0;
    handleChange(field, newCount.toString());

    const typePiece: 'CHAMBRE' | 'SALLE_DE_BAIN' = field === 'nb_chambres' ? 'CHAMBRE' : 'SALLE_DE_BAIN';

    if (pieces.length === 0 && newCount > 0) {
      // Première fois : générer toutes les pièces
      const nbC = field === 'nb_chambres' ? newCount : Number(form.nb_chambres) || 0;
      const nbS = field === 'nb_salles_de_bain' ? newCount : Number(form.nb_salles_de_bain) || 0;
      setPieces(generateDefaultPieces(nbC, nbS));
      return;
    }

    if (newCount === oldCount) return;

    if (newCount > oldCount) {
      const { pieces: newPieces } = adjustPiecesForCount(pieces, typePiece, oldCount, newCount);
      setPieces(newPieces);
    } else {
      // Diminution : demander confirmation
      const piecesOfType = pieces.filter((p) => p.type_piece === typePiece);
      const toRemove = piecesOfType.slice(newCount);
      if (toRemove.length > 0) {
        setConfirmRemove(`remove:${typePiece}:${oldCount}:${newCount}`);
      }
    }
  }

  function confirmPieceRemoval() {
    if (!confirmRemove) return;
    const [, typePiece, oldStr, newStr] = confirmRemove.split(':');
    const { pieces: newPieces } = adjustPiecesForCount(
      pieces,
      typePiece as 'CHAMBRE' | 'SALLE_DE_BAIN',
      Number(oldStr),
      Number(newStr),
    );
    setPieces(newPieces);
    setConfirmRemove(null);
  }

  function cancelPieceRemoval() {
    if (!confirmRemove) return;
    const [, typePiece, oldStr] = confirmRemove.split(':');
    const field = typePiece === 'CHAMBRE' ? 'nb_chambres' : 'nb_salles_de_bain';
    handleChange(field, oldStr);
    setConfirmRemove(null);
  }

  function addPiece() {
    const maxOrdre = pieces.length > 0 ? Math.max(...pieces.map((p) => p.ordre)) : -1;
    setPieces([...pieces, { nom: 'Nouvelle pièce', type_piece: 'AUTRE', ordre: maxOrdre + 1 }]);
  }

  function removePiece(index: number) {
    setPieces(pieces.filter((_, i) => i !== index));
  }

  function renamePiece(index: number, nom: string) {
    setPieces(pieces.map((p, i) => i === index ? { ...p, nom } : p));
  }

  function movePiece(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= pieces.length) return;
    const newPieces = [...pieces];
    const tmp = newPieces[index].ordre;
    newPieces[index] = { ...newPieces[index], ordre: newPieces[target].ordre };
    newPieces[target] = { ...newPieces[target], ordre: tmp };
    [newPieces[index], newPieces[target]] = [newPieces[target], newPieces[index]];
    setPieces(newPieces);
  }

  function resetPieces() {
    const nbC = Number(form.nb_chambres) || 0;
    const nbS = Number(form.nb_salles_de_bain) || 0;
    setPieces(generateDefaultPieces(nbC, nbS));
  }

  // ─── Handlers saisons ────────────────────────────────────

  function toggleSaisons(enabled: boolean) {
    setSaisonsEnabled(enabled);
    if (enabled && saisons.length === 0) {
      setSaisons(getDefaultSaisons());
    }
  }

  function updateSaison(nomSaison: string, field: keyof SaisonConfig, value: string | number | null) {
    setSaisons((prev) =>
      prev.map((s) => s.nom_saison === nomSaison ? { ...s, [field]: value } : s),
    );
  }

  function resetSaisons() {
    setSaisons(getDefaultSaisons());
  }

  // ─── Validation ──────────────────────────────────────────

  function validate(): string | null {
    if (!form.nom.trim()) return 'Le nom est requis.';
    if (!form.adresse.trim()) return "L'adresse est requise.";
    if (!form.capacite_personnes || Number(form.capacite_personnes) < 1) return 'La capacité doit être au moins 1.';
    if (form.heure_checkin === form.heure_checkout) return 'Les heures de check-in et check-out doivent être différentes.';

    if (saisonsEnabled) {
      const saisonError = validateSaisons(saisons);
      if (saisonError) return saisonError;
    }

    return null;
  }

  // ─── Soumission ──────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    const payload = {
      nom: form.nom.trim(),
      adresse: form.adresse.trim(),
      type: form.type,
      surface_m2: form.surface_m2 ? Number(form.surface_m2) : null,
      capacite_personnes: Number(form.capacite_personnes),
      nb_pieces: form.nb_pieces ? Number(form.nb_pieces) : null,
      nb_chambres: Number(form.nb_chambres) || 0,
      nb_salles_de_bain: Number(form.nb_salles_de_bain) || 0,
      heure_checkin: form.heure_checkin,
      heure_checkout: form.heure_checkout,
      buffer_heures: Number(form.buffer_heures),
      taux_taxe_sejour: Number(form.taux_taxe_sejour),
      duree_expiration_option_jours: Number(form.duree_expiration_option_jours),
      taches_auto_enabled: form.taches_auto_enabled,
      description: form.description.trim() || null,
      equipements: form.equipements.trim() || null,
      forfait_menage_eur: form.forfait_menage_eur ? Number(form.forfait_menage_eur) : null,
      charges_incluses: form.charges_incluses.trim() || null,
      animaux_autorises: form.animaux_autorises,
      animaux_types: form.animaux_autorises ? (form.animaux_types.trim() || null) : null,
      animaux_nb_max: form.animaux_autorises && form.animaux_nb_max ? Number(form.animaux_nb_max) : null,
      animaux_taille_max: form.animaux_autorises ? (form.animaux_taille_max || null) : null,
      loyer_nuit_defaut: form.loyer_nuit_defaut ? Number(form.loyer_nuit_defaut) : null,
      loyer_semaine_defaut: form.loyer_semaine_defaut ? Number(form.loyer_semaine_defaut) : null,
    };

    try {
      let logementId: string;
      if (isEdit) {
        await updateLogement(id!, payload);
        logementId = id!;
      } else {
        const created = await createLogement(payload);
        logementId = created.id;
      }

      // Sauvegarder les pièces (si l'onglet a été chargé ou si c'est une création)
      if (piecesLoaded || !isEdit) {
        await upsertLogementPieces(logementId, pieces);
      }

      // Sauvegarder les saisons
      if (saisonsLoaded || !isEdit) {
        if (saisonsEnabled) {
          await upsertLogementSaisons(
            logementId,
            saisons.map((s) => ({
              nom_saison: s.nom_saison,
              loyer_nuit: s.loyer_nuit,
              loyer_semaine: s.loyer_semaine,
              date_debut: s.date_debut,
              date_fin: s.date_fin,
              ordre: s.ordre,
            })),
          );
        } else {
          // Désactivé : supprimer les saisons existantes
          await upsertLogementSaisons(logementId, []);
        }
      }

      // Sauvegarder les accès utilisateurs (si l'onglet a été chargé)
      if (accessLoaded) {
        await setLogementAccess(logementId, selectedUserIds);
      }

      // Forcer le rafraîchissement du contexte pour que tous les écrans voient le nouveau logement
      await refreshLogements();

      navigate('/parametres/logements');
    } catch {
      setError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Rendu ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Périodes haute saison calculées
  const basse = saisons.find((s) => s.nom_saison === SAISON_BASSE);
  const tresHaute = saisons.find((s) => s.nom_saison === SAISON_TRES_HAUTE);
  const hautePeriods = basse && tresHaute && basse.date_debut && basse.date_fin && tresHaute.date_debut && tresHaute.date_fin
    ? computeHauteSaisonPeriods(basse, tresHaute)
    : [];

  return (
    <div className="space-y-6">
      <Link to="/parametres/logements" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux logements
      </Link>

      <h2 className="text-lg font-semibold">
        {isEdit ? 'Modifier le logement' : 'Nouveau logement'}
      </h2>

      {/* Onglets */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

        {/* ════════════════════════════════════════════════════════
            ONGLET : GÉNÉRAL
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'general' && (
          <>
            {/* Informations générales */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-medium text-slate-900">Informations générales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="nom" className="block text-sm font-medium text-slate-700">
                    Nom <span className="text-red-500">*</span>
                  </label>
                  <input id="nom" type="text" required maxLength={100} value={form.nom}
                    onChange={(e) => handleChange('nom', e.target.value)} className={INPUT_CLASS} placeholder="Mon appartement" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="adresse" className="block text-sm font-medium text-slate-700">
                    Adresse <span className="text-red-500">*</span>
                  </label>
                  <AddressAutocomplete id="adresse" value={form.adresse} onChange={(v) => handleChange('adresse', v)}
                    pays="France" placeholder="123 rue de la Paix, 75001 Paris" required />
                </div>
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-slate-700">Type <span className="text-red-500">*</span></label>
                  <select id="type" value={form.type} onChange={(e) => handleChange('type', e.target.value)} className={INPUT_CLASS}>
                    {LOGEMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="surface_m2" className="block text-sm font-medium text-slate-700">Surface (m²)</label>
                  <input id="surface_m2" type="number" min={1} value={form.surface_m2}
                    onChange={(e) => handleChange('surface_m2', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="capacite_personnes" className="block text-sm font-medium text-slate-700">
                    Capacité (personnes) <span className="text-red-500">*</span>
                  </label>
                  <input id="capacite_personnes" type="number" required min={1} value={form.capacite_personnes}
                    onChange={(e) => handleChange('capacite_personnes', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="nb_pieces" className="block text-sm font-medium text-slate-700">Nombre de pièces</label>
                  <input id="nb_pieces" type="number" min={1} value={form.nb_pieces}
                    onChange={(e) => handleChange('nb_pieces', e.target.value)} className={INPUT_CLASS} />
                </div>
              </div>
            </div>

            {/* Règles */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-medium text-slate-900">Règles</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="heure_checkin" className="block text-sm font-medium text-slate-700">Heure check-in</label>
                  <input id="heure_checkin" type="time" value={form.heure_checkin}
                    onChange={(e) => handleChange('heure_checkin', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="heure_checkout" className="block text-sm font-medium text-slate-700">Heure check-out</label>
                  <input id="heure_checkout" type="time" value={form.heure_checkout}
                    onChange={(e) => handleChange('heure_checkout', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="buffer_heures" className="block text-sm font-medium text-slate-700">Tampon ménage (heures)</label>
                  <input id="buffer_heures" type="number" min={0} value={form.buffer_heures}
                    onChange={(e) => handleChange('buffer_heures', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="taux_taxe_sejour" className="block text-sm font-medium text-slate-700">Taxe de séjour (€/pers/nuit)</label>
                  <input id="taux_taxe_sejour" type="number" min={0} step={0.01} value={form.taux_taxe_sejour}
                    onChange={(e) => handleChange('taux_taxe_sejour', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="duree_expiration_option_jours" className="block text-sm font-medium text-slate-700">Expiration option (jours)</label>
                  <input id="duree_expiration_option_jours" type="number" min={1} value={form.duree_expiration_option_jours}
                    onChange={(e) => handleChange('duree_expiration_option_jours', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div className="flex items-center gap-3 sm:col-span-2 pt-2">
                  <Toggle checked={form.taches_auto_enabled} onChange={(v) => handleChange('taches_auto_enabled', v)} label="Tâches automatiques activées" />
                </div>
              </div>
            </div>

            {/* Description & équipements */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-medium text-slate-900">Description & équipements</h3>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700">Description</label>
                <textarea id="description" rows={3} value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)} placeholder="Appartement lumineux au cœur de Paris…"
                  className={INPUT_CLASS + ' resize-none'} />
              </div>
              <div>
                <label htmlFor="equipements" className="block text-sm font-medium text-slate-700">Équipements</label>
                <textarea id="equipements" rows={2} value={form.equipements}
                  onChange={(e) => handleChange('equipements', e.target.value)} placeholder="Wifi, TV, cuisine équipée, machine à laver…"
                  className={INPUT_CLASS + ' resize-none'} />
              </div>
              <div>
                <label htmlFor="charges_incluses" className="block text-sm font-medium text-slate-700">Charges incluses</label>
                <textarea id="charges_incluses" rows={2} value={form.charges_incluses}
                  onChange={(e) => handleChange('charges_incluses', e.target.value)} placeholder="Eau, électricité, chauffage, wifi…"
                  className={INPUT_CLASS + ' resize-none'} />
              </div>
            </div>

            {/* Animaux */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-medium text-slate-900">Animaux</h3>
              <Toggle checked={form.animaux_autorises} onChange={(v) => handleChange('animaux_autorises', v)} label="Animaux autorisés" />
              {form.animaux_autorises && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-2 border-l-2 border-primary-100">
                  <div>
                    <label htmlFor="animaux_types" className="block text-sm font-medium text-slate-700">Types acceptés</label>
                    <input id="animaux_types" type="text" value={form.animaux_types}
                      onChange={(e) => handleChange('animaux_types', e.target.value)} placeholder="Chiens, chats, NAC…" className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label htmlFor="animaux_nb_max" className="block text-sm font-medium text-slate-700">Nombre max</label>
                    <input id="animaux_nb_max" type="number" min={1} value={form.animaux_nb_max}
                      onChange={(e) => handleChange('animaux_nb_max', e.target.value)} placeholder="1" className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label htmlFor="animaux_taille_max" className="block text-sm font-medium text-slate-700">Gabarit max</label>
                    <select id="animaux_taille_max" value={form.animaux_taille_max}
                      onChange={(e) => handleChange('animaux_taille_max', e.target.value)} className={INPUT_CLASS}>
                      {ANIMAUX_TAILLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            ONGLET : PIÈCES EDL
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'pieces' && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-medium text-slate-900">Structure du logement</h3>
              <p className="text-xs text-slate-500">
                Définissez le nombre de chambres et salles de bain. Les pièces de l'EDL seront générées automatiquement.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nb_chambres" className="block text-sm font-medium text-slate-700">Chambres</label>
                  <input id="nb_chambres" type="number" min={0} max={20} value={form.nb_chambres}
                    onChange={(e) => handleNbChange('nb_chambres', e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label htmlFor="nb_salles_de_bain" className="block text-sm font-medium text-slate-700">Salles de bain</label>
                  <input id="nb_salles_de_bain" type="number" min={0} max={10} value={form.nb_salles_de_bain}
                    onChange={(e) => handleNbChange('nb_salles_de_bain', e.target.value)} className={INPUT_CLASS} />
                </div>
              </div>

              {/* Confirmation suppression */}
              {confirmRemove && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm">
                  <p className="text-amber-800 font-medium mb-2">Supprimer les pièces excédentaires ?</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={confirmPieceRemoval}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700">
                      Oui, supprimer
                    </button>
                    <button type="button" onClick={cancelPieceRemoval}
                      className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Liste des pièces */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-slate-900">Pièces pour l'EDL ({pieces.length})</h3>
                {pieces.length > 0 && (
                  <button type="button" onClick={resetPieces} title="Réinitialiser"
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Réinitialiser
                  </button>
                )}
              </div>

              {pieces.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400 mb-3">Aucune pièce configurée.</p>
                  <button type="button" onClick={() => {
                    const nbC = Number(form.nb_chambres) || 0;
                    const nbS = Number(form.nb_salles_de_bain) || 0;
                    if (nbC > 0 || nbS > 0) {
                      setPieces(generateDefaultPieces(nbC, nbS));
                    } else {
                      addPiece();
                    }
                  }} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium">
                    <Plus className="h-4 w-4" />
                    Générer les pièces
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {pieces.map((piece, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button type="button" onClick={() => movePiece(index, -1)} disabled={index === 0}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => movePiece(index, 1)} disabled={index === pieces.length - 1}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-slate-400 w-5 text-center">{index + 1}</span>
                      <input type="text" value={piece.nom} onChange={(e) => renamePiece(index, e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none" />
                      <span className="text-[10px] text-slate-400 w-16 text-center">{piece.type_piece}</span>
                      <button type="button" onClick={() => removePiece(index)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {pieces.length > 0 && (
                <button type="button" onClick={addPiece}
                  className="w-full flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                  <Plus className="h-4 w-4" />
                  Ajouter une pièce
                </button>
              )}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            ONGLET : TARIFS
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'tarifs' && (
          <>
            {/* Forfait ménage — commun aux deux modes */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-medium text-slate-900 mb-4">Forfait ménage</h3>
              <div className="w-48">
                <label htmlFor="forfait_menage_eur" className="block text-sm font-medium text-slate-700 mb-1">Montant (€)</label>
                <input id="forfait_menage_eur" type="number" min={0} step={0.01} value={form.forfait_menage_eur}
                  onChange={(e) => handleChange('forfait_menage_eur', e.target.value)} placeholder="0.00" className={INPUT_CLASS} />
              </div>
            </div>

            {/* Sélecteur de mode tarifaire */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 gap-1">
              <button type="button" onClick={() => toggleSaisons(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${!saisonsEnabled ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                Tarification unique
              </button>
              <button type="button" onClick={() => toggleSaisons(true)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${saisonsEnabled ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                Tarification saisonnière
              </button>
            </div>

            {/* ── Tarification unique ── */}
            {!saisonsEnabled && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="loyer_nuit_defaut" className="block text-sm font-medium text-slate-700">Loyer / nuit (€)</label>
                    <input id="loyer_nuit_defaut" type="number" min={0} step={0.01} value={form.loyer_nuit_defaut}
                      onChange={(e) => handleChange('loyer_nuit_defaut', e.target.value)} placeholder="0.00" className={INPUT_CLASS} />
                  </div>
                  <div>
                    <label htmlFor="loyer_semaine_defaut" className="block text-sm font-medium text-slate-700">Loyer / semaine (€)</label>
                    <input id="loyer_semaine_defaut" type="number" min={0} step={0.01} value={form.loyer_semaine_defaut}
                      onChange={(e) => handleChange('loyer_semaine_defaut', e.target.value)} placeholder="Optionnel" className={INPUT_CLASS} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Tarification saisonnière ── */}
            {saisonsEnabled && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" />
                    La haute saison couvre automatiquement les périodes non couvertes par les deux autres.
                  </p>
                  <button type="button" onClick={resetSaisons}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Réinitialiser
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Basse saison */}
                  {basse && (
                    <SaisonCard
                      label={SAISON_BASSE}
                      color="blue"
                      dateDebut={basse.date_debut}
                      dateFin={basse.date_fin}
                      loyerNuit={basse.loyer_nuit}
                      loyerSemaine={basse.loyer_semaine}
                      onDateDebutChange={(v) => updateSaison(SAISON_BASSE, 'date_debut', v)}
                      onDateFinChange={(v) => updateSaison(SAISON_BASSE, 'date_fin', v)}
                      onLoyerNuitChange={(v) => updateSaison(SAISON_BASSE, 'loyer_nuit', v)}
                      onLoyerSemaineChange={(v) => updateSaison(SAISON_BASSE, 'loyer_semaine', v)}
                    />
                  )}

                  {/* Haute saison (calculée) */}
                  {saisons.find((s) => s.nom_saison === SAISON_HAUTE) && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-amber-800">{SAISON_HAUTE}</span>
                        <span className="text-[10px] text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Calculée automatiquement</span>
                      </div>
                      {hautePeriods.length > 0 ? (
                        <p className="text-xs text-amber-700">
                          {hautePeriods.map((seg, i) => (
                            <span key={i}>
                              {i > 0 && ' + '}
                              {formatMMDD(seg.debut)} au {formatMMDD(seg.fin)}
                            </span>
                          ))}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600">Aucune période disponible. Ajustez les dates des autres saisons.</p>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-amber-700 mb-1">Loyer / nuit (€)</label>
                          <input type="number" min={0} step={0.01}
                            value={saisons.find((s) => s.nom_saison === SAISON_HAUTE)!.loyer_nuit || ''}
                            onChange={(e) => updateSaison(SAISON_HAUTE, 'loyer_nuit', Number(e.target.value) || 0)}
                            placeholder="0.00" className={INPUT_CLASS} />
                        </div>
                        <div>
                          <label className="block text-xs text-amber-700 mb-1">Loyer / semaine (€)</label>
                          <input type="number" min={0} step={0.01}
                            value={saisons.find((s) => s.nom_saison === SAISON_HAUTE)!.loyer_semaine ?? ''}
                            onChange={(e) => updateSaison(SAISON_HAUTE, 'loyer_semaine', e.target.value ? Number(e.target.value) : null)}
                            placeholder="Optionnel" className={INPUT_CLASS} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Très haute saison */}
                  {tresHaute && (
                    <SaisonCard
                      label={SAISON_TRES_HAUTE}
                      color="red"
                      dateDebut={tresHaute.date_debut}
                      dateFin={tresHaute.date_fin}
                      loyerNuit={tresHaute.loyer_nuit}
                      loyerSemaine={tresHaute.loyer_semaine}
                      onDateDebutChange={(v) => updateSaison(SAISON_TRES_HAUTE, 'date_debut', v)}
                      onDateFinChange={(v) => updateSaison(SAISON_TRES_HAUTE, 'date_fin', v)}
                      onLoyerNuitChange={(v) => updateSaison(SAISON_TRES_HAUTE, 'loyer_nuit', v)}
                      onLoyerSemaineChange={(v) => updateSaison(SAISON_TRES_HAUTE, 'loyer_semaine', v)}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════
            ONGLET : ACCÈS
            ════════════════════════════════════════════════════════ */}
        {activeTab === 'acces' && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-medium text-slate-900">Accès co-hôtes et concierges</h3>
            <p className="text-sm text-slate-500">
              L'administrateur a toujours accès à tous les logements. Cochez les utilisateurs qui doivent voir et gérer ce logement.
            </p>

            {!accessLoaded ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
              </div>
            ) : activeUsers.length === 0 ? (
              <p className="text-sm text-slate-400 italic">Aucun co-hôte ou concierge actif.</p>
            ) : (
              <ul className="space-y-2">
                {activeUsers.map((u) => {
                  const checked = selectedUserIds.includes(u.id);
                  return (
                    <li key={u.id}>
                      <label className="flex items-center gap-3 cursor-pointer rounded-lg p-2 hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedUserIds((prev) =>
                              e.target.checked ? [...prev, u.id] : prev.filter((uid) => uid !== u.id),
                            );
                          }}
                        />
                        <span className="text-sm text-slate-700 font-medium">
                          {u.prenom} {u.nom}
                        </span>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === 'COHOTE'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {u.role === 'COHOTE' ? 'Co-hôte' : 'Concierge'}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            ERREUR + BOUTONS
            ════════════════════════════════════════════════════════ */}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Enregistrer' : 'Créer le logement'}
          </button>
          <Link to="/parametres/logements"
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}

// ─── Sous-composant : Carte saison ────────────────────────────

function SaisonCard({
  label, color, dateDebut, dateFin, loyerNuit, loyerSemaine,
  onDateDebutChange, onDateFinChange, onLoyerNuitChange, onLoyerSemaineChange,
}: {
  label: string;
  color: 'blue' | 'red';
  dateDebut: string;
  dateFin: string;
  loyerNuit: number;
  loyerSemaine: number | null;
  onDateDebutChange: (v: string) => void;
  onDateFinChange: (v: string) => void;
  onLoyerNuitChange: (v: number) => void;
  onLoyerSemaineChange: (v: number | null) => void;
}) {
  const borderColor = color === 'blue' ? 'border-blue-200' : 'border-red-200';
  const bgColor = color === 'blue' ? 'bg-blue-50/50' : 'bg-red-50/50';
  const textColor = color === 'blue' ? 'text-blue-800' : 'text-red-800';
  const labelColor = color === 'blue' ? 'text-blue-700' : 'text-red-700';

  // Convertir MM-DD en inputs jour/mois
  const [debutM, debutD] = dateDebut ? dateDebut.split('-').map(Number) : [1, 1];
  const [finM, finD] = dateFin ? dateFin.split('-').map(Number) : [1, 1];

  function handleDateChange(type: 'debut' | 'fin', part: 'month' | 'day', value: number) {
    const current = type === 'debut' ? { m: debutM, d: debutD } : { m: finM, d: finD };
    if (part === 'month') current.m = value;
    else current.d = value;
    const mmdd = `${String(current.m).padStart(2, '0')}-${String(current.d).padStart(2, '0')}`;
    (type === 'debut' ? onDateDebutChange : onDateFinChange)(mmdd);
  }

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4 space-y-3`}>
      <span className={`text-sm font-medium ${textColor}`}>{label}</span>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={`block text-xs ${labelColor} mb-1`}>Du (jour/mois)</label>
          <div className="flex gap-1">
            <input type="number" min={1} max={31} value={debutD}
              onChange={(e) => handleDateChange('debut', 'day', Number(e.target.value))}
              className={INPUT_CLASS + ' w-16 text-center'} />
            <span className="self-center text-xs text-slate-400">/</span>
            <input type="number" min={1} max={12} value={debutM}
              onChange={(e) => handleDateChange('debut', 'month', Number(e.target.value))}
              className={INPUT_CLASS + ' w-16 text-center'} />
          </div>
        </div>
        <div>
          <label className={`block text-xs ${labelColor} mb-1`}>Au (jour/mois)</label>
          <div className="flex gap-1">
            <input type="number" min={1} max={31} value={finD}
              onChange={(e) => handleDateChange('fin', 'day', Number(e.target.value))}
              className={INPUT_CLASS + ' w-16 text-center'} />
            <span className="self-center text-xs text-slate-400">/</span>
            <input type="number" min={1} max={12} value={finM}
              onChange={(e) => handleDateChange('fin', 'month', Number(e.target.value))}
              className={INPUT_CLASS + ' w-16 text-center'} />
          </div>
        </div>
        <div>
          <label className={`block text-xs ${labelColor} mb-1`}>Loyer / nuit (€)</label>
          <input type="number" min={0} step={0.01} value={loyerNuit || ''}
            onChange={(e) => onLoyerNuitChange(Number(e.target.value) || 0)}
            placeholder="0.00" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={`block text-xs ${labelColor} mb-1`}>Loyer / semaine (€)</label>
          <input type="number" min={0} step={0.01} value={loyerSemaine ?? ''}
            onChange={(e) => onLoyerSemaineChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="Optionnel" className={INPUT_CLASS} />
        </div>
      </div>
    </div>
  );
}
