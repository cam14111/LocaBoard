import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { createLogement, getLogementById, updateLogement } from '@/lib/api/logements';

const LOGEMENT_TYPES = [
  { value: 'appartement', label: 'Appartement' },
  { value: 'maison', label: 'Maison' },
  { value: 'studio', label: 'Studio' },
  { value: 'chambre', label: 'Chambre' },
  { value: 'autre', label: 'Autre' },
];

interface FormData {
  nom: string;
  adresse: string;
  type: string;
  surface_m2: string;
  capacite_personnes: string;
  nb_pieces: string;
  heure_checkin: string;
  heure_checkout: string;
  buffer_heures: string;
  taux_taxe_sejour: string;
  duree_expiration_option_jours: string;
  taches_auto_enabled: boolean;
}

const INITIAL: FormData = {
  nom: '',
  adresse: '',
  type: 'appartement',
  surface_m2: '',
  capacite_personnes: '',
  nb_pieces: '',
  heure_checkin: '15:00',
  heure_checkout: '10:00',
  buffer_heures: '4',
  taux_taxe_sejour: '0',
  duree_expiration_option_jours: '3',
  taches_auto_enabled: true,
};

export default function LogementForm() {
  const { id } = useParams();
  const isEdit = id !== undefined && id !== 'nouveau';
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>(INITIAL);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
          heure_checkin: logement.heure_checkin.slice(0, 5),
          heure_checkout: logement.heure_checkout.slice(0, 5),
          buffer_heures: logement.buffer_heures.toString(),
          taux_taxe_sejour: logement.taux_taxe_sejour.toString(),
          duree_expiration_option_jours: logement.duree_expiration_option_jours.toString(),
          taches_auto_enabled: logement.taches_auto_enabled,
        });
      })
      .catch(() => setError('Impossible de charger le logement.'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function handleChange(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate(): string | null {
    if (!form.nom.trim()) return 'Le nom est requis.';
    if (!form.adresse.trim()) return 'L\'adresse est requise.';
    if (!form.capacite_personnes || Number(form.capacite_personnes) < 1) return 'La capacité doit être au moins 1.';
    if (form.heure_checkin === form.heure_checkout) return 'Les heures de check-in et check-out doivent être différentes.';
    return null;
  }

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
      heure_checkin: form.heure_checkin,
      heure_checkout: form.heure_checkout,
      buffer_heures: Number(form.buffer_heures),
      taux_taxe_sejour: Number(form.taux_taxe_sejour),
      duree_expiration_option_jours: Number(form.duree_expiration_option_jours),
      taches_auto_enabled: form.taches_auto_enabled,
    };

    try {
      if (isEdit) {
        await updateLogement(id!, payload);
      } else {
        await createLogement(payload);
      }
      navigate('/parametres/logements');
    } catch {
      setError('Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/parametres/logements" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Retour aux logements
      </Link>

      <h2 className="text-lg font-semibold">
        {isEdit ? 'Modifier le logement' : 'Nouveau logement'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        {/* Section 1 : Informations générales */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-medium text-slate-900">Informations générales</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="nom" className="block text-sm font-medium text-slate-700">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                id="nom"
                type="text"
                required
                maxLength={100}
                value={form.nom}
                onChange={(e) => handleChange('nom', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                placeholder="Mon appartement"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="adresse" className="block text-sm font-medium text-slate-700">
                Adresse <span className="text-red-500">*</span>
              </label>
              <input
                id="adresse"
                type="text"
                required
                value={form.adresse}
                onChange={(e) => handleChange('adresse', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                placeholder="123 rue de la Paix, 75001 Paris"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-slate-700">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                value={form.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              >
                {LOGEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="surface_m2" className="block text-sm font-medium text-slate-700">
                Surface (m²)
              </label>
              <input
                id="surface_m2"
                type="number"
                min={1}
                value={form.surface_m2}
                onChange={(e) => handleChange('surface_m2', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="capacite_personnes" className="block text-sm font-medium text-slate-700">
                Capacité (personnes) <span className="text-red-500">*</span>
              </label>
              <input
                id="capacite_personnes"
                type="number"
                required
                min={1}
                value={form.capacite_personnes}
                onChange={(e) => handleChange('capacite_personnes', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="nb_pieces" className="block text-sm font-medium text-slate-700">
                Nombre de pièces
              </label>
              <input
                id="nb_pieces"
                type="number"
                min={1}
                value={form.nb_pieces}
                onChange={(e) => handleChange('nb_pieces', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2 : Règles */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-medium text-slate-900">Règles</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="heure_checkin" className="block text-sm font-medium text-slate-700">
                Heure check-in
              </label>
              <input
                id="heure_checkin"
                type="time"
                value={form.heure_checkin}
                onChange={(e) => handleChange('heure_checkin', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="heure_checkout" className="block text-sm font-medium text-slate-700">
                Heure check-out
              </label>
              <input
                id="heure_checkout"
                type="time"
                value={form.heure_checkout}
                onChange={(e) => handleChange('heure_checkout', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="buffer_heures" className="block text-sm font-medium text-slate-700">
                Tampon ménage (heures)
              </label>
              <input
                id="buffer_heures"
                type="number"
                min={0}
                value={form.buffer_heures}
                onChange={(e) => handleChange('buffer_heures', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="taux_taxe_sejour" className="block text-sm font-medium text-slate-700">
                Taxe de séjour (€/pers/nuit)
              </label>
              <input
                id="taux_taxe_sejour"
                type="number"
                min={0}
                step={0.01}
                value={form.taux_taxe_sejour}
                onChange={(e) => handleChange('taux_taxe_sejour', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="duree_expiration_option_jours" className="block text-sm font-medium text-slate-700">
                Expiration option (jours)
              </label>
              <input
                id="duree_expiration_option_jours"
                type="number"
                min={1}
                value={form.duree_expiration_option_jours}
                onChange={(e) => handleChange('duree_expiration_option_jours', e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 sm:col-span-2 pt-2">
              <button
                type="button"
                role="switch"
                aria-checked={form.taches_auto_enabled}
                onClick={() => handleChange('taches_auto_enabled', !form.taches_auto_enabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  form.taches_auto_enabled ? 'bg-primary-600' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                    form.taches_auto_enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <label className="text-sm font-medium text-slate-700">
                Tâches automatiques activées
              </label>
            </div>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'Enregistrer' : 'Créer le logement'}
          </button>
          <Link
            to="/parametres/logements"
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
