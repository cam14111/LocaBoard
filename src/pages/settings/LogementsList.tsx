import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Archive, Home, Building2, Loader2 } from 'lucide-react';
import { getLogements, archiveLogement } from '@/lib/api/logements';
import { supabase } from '@/lib/supabase';
import PermissionGate from '@/components/ui/PermissionGate';
import type { Logement } from '@/types/database.types';

const typeIcons: Record<string, typeof Home> = {
  maison: Home,
  appartement: Building2,
};

export default function LogementsList() {
  const [logements, setLogements] = useState<Logement[]>([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState<string | null>(null);

  async function fetchLogements() {
    try {
      const data = await getLogements();
      setLogements(data);
    } catch (err) {
      console.error('Erreur chargement logements:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLogements(); }, []);

  async function handleArchive(logement: Logement) {
    if (!confirm(`Archiver le logement « ${logement.nom} » ? Cette action est réversible.`)) return;

    setArchiving(logement.id);
    try {
      // Vérifier les réservations actives
      const { data: reservations } = await supabase
        .from('reservations')
        .select('id')
        .eq('logement_id', logement.id)
        .is('archived_at', null)
        .in('statut', ['OPTION_ACTIVE', 'CONFIRMEE'])
        .limit(1);

      if (reservations && reservations.length > 0) {
        alert('Impossible d\'archiver ce logement : il a des réservations actives.');
        return;
      }

      await archiveLogement(logement.id);
      setLogements((prev) => prev.filter((l) => l.id !== logement.id));
    } catch (err) {
      console.error('Erreur archivage:', err);
      alert('Erreur lors de l\'archivage du logement.');
    } finally {
      setArchiving(null);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link to="/parametres" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
        <PermissionGate permission="logement:create">
          <Link
            to="/parametres/logements/nouveau"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </Link>
        </PermissionGate>
      </div>

      {logements.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Home className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <p className="font-medium">Aucun logement</p>
          <p className="text-sm mt-1">Commencez par ajouter votre premier logement.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {logements.map((logement) => {
            const Icon = typeIcons[logement.type] ?? Home;
            return (
              <div
                key={logement.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary-50 p-2">
                      <Icon className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{logement.nom}</h3>
                      <p className="text-sm text-slate-500">{logement.adresse}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mb-4">
                  <div>
                    <span className="text-slate-400">Type : </span>
                    <span className="capitalize">{logement.type}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Capacité : </span>
                    {logement.capacite_personnes} pers.
                  </div>
                  <div>
                    <span className="text-slate-400">Check-in : </span>
                    {logement.heure_checkin.slice(0, 5)}
                  </div>
                  <div>
                    <span className="text-slate-400">Check-out : </span>
                    {logement.heure_checkout.slice(0, 5)}
                  </div>
                  <div>
                    <span className="text-slate-400">Tampon : </span>
                    {logement.buffer_heures}h
                  </div>
                  <div>
                    <span className="text-slate-400">Taxe : </span>
                    {logement.taux_taxe_sejour > 0
                      ? `${logement.taux_taxe_sejour} €/pers/nuit`
                      : '—'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PermissionGate permission="logement:edit">
                    <Link
                      to={`/parametres/logements/${logement.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modifier
                    </Link>
                  </PermissionGate>
                  <PermissionGate permission="logement:archive">
                    <button
                      type="button"
                      onClick={() => handleArchive(logement)}
                      disabled={archiving === logement.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {archiving === logement.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                      Archiver
                    </button>
                  </PermissionGate>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
