import { supabase } from '@/lib/supabase';
import { createNotification } from '@/lib/api/notifications';

/** Formatte une date ISO en format court français */
function formatDateFr(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

// ─── E10-03 : Options ────────────────────────────────────────

/** Options actives expirant sous 24h → OPTION_EXPIRE_BIENTOT */
async function notifyExpiringSoonOptions(userId: string) {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 3_600_000);

  const { data: options } = await supabase
    .from('reservations')
    .select('id, locataire_nom, locataire_prenom, expiration_at')
    .eq('statut', 'OPTION_ACTIVE')
    .gte('expiration_at', now.toISOString())
    .lte('expiration_at', in24h.toISOString())
    .is('archived_at', null);

  if (!options || options.length === 0) return;

  for (const opt of options) {
    const hoursLeft = Math.ceil(
      (new Date(opt.expiration_at!).getTime() - now.getTime()) / 3_600_000,
    );
    await createNotification({
      user_id: userId,
      type: 'OPTION_EXPIRE_BIENTOT',
      titre: 'Option expire bientôt',
      message: `${opt.locataire_prenom} ${opt.locataire_nom} — expire dans ${hoursLeft}h`,
      entity_type: 'reservation',
      entity_id: opt.id,
    });
  }
}

/** Options récemment expirées → OPTION_EXPIREE */
async function notifyExpiredOptions(userId: string) {
  const { data: expired } = await supabase
    .from('reservations')
    .select('id, locataire_nom, locataire_prenom')
    .eq('statut', 'OPTION_EXPIREE')
    .is('archived_at', null);

  if (!expired || expired.length === 0) return;

  for (const opt of expired) {
    await createNotification({
      user_id: userId,
      type: 'OPTION_EXPIREE',
      titre: 'Option expirée',
      message: `${opt.locataire_prenom} ${opt.locataire_nom} — créneau libéré`,
      entity_type: 'reservation',
      entity_id: opt.id,
    });
  }
}

// ─── E10-04 : Paiements ─────────────────────────────────────

/** Paiements en retard → PAIEMENT_EN_RETARD (1 notif par dossier) */
async function notifyOverduePaiements(userId: string) {
  const { data: overdue } = await supabase
    .from('paiements')
    .select('id, type, montant_eur, echeance_date, dossier_id')
    .eq('statut', 'EN_RETARD');

  if (!overdue || overdue.length === 0) return;

  // Grouper par dossier pour 1 notification par dossier
  const byDossier = new Map<string, typeof overdue>();
  for (const p of overdue) {
    const arr = byDossier.get(p.dossier_id) ?? [];
    arr.push(p);
    byDossier.set(p.dossier_id, arr);
  }

  for (const [dossierId, paiements] of byDossier) {
    const total = paiements.reduce((s, p) => s + p.montant_eur, 0);
    const msg =
      paiements.length === 1
        ? `${paiements[0].type} ${paiements[0].montant_eur} € — dû le ${formatDateFr(paiements[0].echeance_date)}`
        : `${paiements.length} paiements en retard — total ${total} €`;

    await createNotification({
      user_id: userId,
      type: 'PAIEMENT_EN_RETARD',
      titre: 'Paiement en retard',
      message: msg,
      entity_type: 'dossier',
      entity_id: dossierId,
    });
  }
}

/** Paiements DU dans les 3 prochains jours → PAIEMENT_DU_BIENTOT */
async function notifyUpcomingPaiements(userId: string) {
  const today = new Date();
  const in3days = new Date(today.getTime() + 3 * 86_400_000);
  const todayStr = today.toISOString().substring(0, 10);
  const in3daysStr = in3days.toISOString().substring(0, 10);

  const { data: upcoming } = await supabase
    .from('paiements')
    .select('id, type, montant_eur, echeance_date, dossier_id')
    .eq('statut', 'DU')
    .gte('echeance_date', todayStr)
    .lte('echeance_date', in3daysStr);

  if (!upcoming || upcoming.length === 0) return;

  const byDossier = new Map<string, typeof upcoming>();
  for (const p of upcoming) {
    const arr = byDossier.get(p.dossier_id) ?? [];
    arr.push(p);
    byDossier.set(p.dossier_id, arr);
  }

  for (const [dossierId, paiements] of byDossier) {
    const total = paiements.reduce((s, p) => s + p.montant_eur, 0);
    const msg =
      paiements.length === 1
        ? `${paiements[0].type} ${paiements[0].montant_eur} € — dû le ${formatDateFr(paiements[0].echeance_date)}`
        : `${paiements.length} paiements bientôt dus — total ${total} €`;

    await createNotification({
      user_id: userId,
      type: 'PAIEMENT_DU_BIENTOT',
      titre: 'Paiement bientôt dû',
      message: msg,
      entity_type: 'dossier',
      entity_id: dossierId,
    });
  }
}

// ─── E10-05 : Tâches + Arrivées/Départs ─────────────────────

/** Tâches assignées récemment (< 10 min) → TACHE_ASSIGNEE */
async function notifyNewlyAssignedTaches() {
  const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();

  const { data: tasks } = await supabase
    .from('taches')
    .select('id, titre, assignee_user_id, echeance_at')
    .not('assignee_user_id', 'is', null)
    .gte('created_at', tenMinAgo)
    .eq('statut', 'A_FAIRE');

  if (!tasks || tasks.length === 0) return;

  for (const t of tasks) {
    if (!t.assignee_user_id) continue;
    await createNotification({
      user_id: t.assignee_user_id,
      type: 'TACHE_ASSIGNEE',
      titre: 'Nouvelle tâche assignée',
      message: `${t.titre} — échéance ${formatDateFr(t.echeance_at)}`,
      entity_type: 'tache',
      entity_id: t.id,
    });
  }
}

/** Tâches en retard → TACHE_EN_RETARD */
async function notifyTachesEnRetard(userId: string) {
  const now = new Date().toISOString();

  const { data: overdue } = await supabase
    .from('taches')
    .select('id, titre, echeance_at, assignee_user_id')
    .in('statut', ['A_FAIRE', 'EN_COURS'])
    .lt('echeance_at', now);

  if (!overdue || overdue.length === 0) return;

  for (const t of overdue) {
    const targetUser = t.assignee_user_id || userId;
    const daysLate = Math.floor(
      (Date.now() - new Date(t.echeance_at).getTime()) / 86_400_000,
    );
    await createNotification({
      user_id: targetUser,
      type: 'TACHE_EN_RETARD',
      titre: 'Tâche en retard',
      message: `${t.titre} — échéance dépassée de ${daysLate} jour${daysLate > 1 ? 's' : ''}`,
      entity_type: 'tache',
      entity_id: t.id,
    });
  }
}

/** Arrivées demain → ARRIVEE_IMMINENTE */
async function notifyArriveesDemain(userId: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  const { data: arrivals } = await supabase
    .from('reservations')
    .select('id, locataire_nom, locataire_prenom, dossiers(id)')
    .eq('date_debut', tomorrowStr)
    .eq('statut', 'CONFIRMEE')
    .is('archived_at', null);

  if (!arrivals || arrivals.length === 0) return;

  for (const r of arrivals) {
    // Naviguer vers le dossier si disponible, sinon le calendrier
    const dossierArr = r.dossiers as { id: string }[] | null;
    const dossierId = Array.isArray(dossierArr) ? dossierArr[0]?.id : null;
    await createNotification({
      user_id: userId,
      type: 'ARRIVEE_IMMINENTE',
      titre: 'Arrivée demain',
      message: `${r.locataire_prenom} ${r.locataire_nom}`,
      entity_type: dossierId ? 'dossier' : 'reservation',
      entity_id: dossierId ?? r.id,
    });
  }
}

/** Départs demain → DEPART_IMMINENT */
async function notifyDepartsDemain(userId: string) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().substring(0, 10);

  const { data: departures } = await supabase
    .from('reservations')
    .select('id, locataire_nom, locataire_prenom, dossiers(id)')
    .eq('date_fin', tomorrowStr)
    .eq('statut', 'CONFIRMEE')
    .is('archived_at', null);

  if (!departures || departures.length === 0) return;

  for (const r of departures) {
    // Naviguer vers le dossier si disponible, sinon le calendrier
    const dossierArr = r.dossiers as { id: string }[] | null;
    const dossierId = Array.isArray(dossierArr) ? dossierArr[0]?.id : null;
    await createNotification({
      user_id: userId,
      type: 'DEPART_IMMINENT',
      titre: 'Départ demain',
      message: `${r.locataire_prenom} ${r.locataire_nom}`,
      entity_type: dossierId ? 'dossier' : 'reservation',
      entity_id: dossierId ?? r.id,
    });
  }
}

/** EDL à réaliser aujourd'hui → EDL_A_REALISER */
async function notifyEdlAReaRealiser(userId: string) {
  const today = new Date().toISOString().substring(0, 10);

  // Arrivées aujourd'hui = EDL arrivée à réaliser
  const { data: arrivals } = await supabase
    .from('reservations')
    .select('id, locataire_nom, locataire_prenom')
    .eq('date_debut', today)
    .eq('statut', 'CONFIRMEE')
    .is('archived_at', null);

  if (arrivals) {
    for (const r of arrivals) {
      await createNotification({
        user_id: userId,
        type: 'ARRIVEE_IMMINENTE',
        titre: 'EDL arrivée à réaliser',
        message: `${r.locataire_prenom} ${r.locataire_nom} — arrivée aujourd'hui`,
        entity_type: 'reservation',
        entity_id: r.id,
      });
    }
  }

  // Départs aujourd'hui = EDL départ à réaliser
  const { data: departures } = await supabase
    .from('reservations')
    .select('id, locataire_nom, locataire_prenom')
    .eq('date_fin', today)
    .eq('statut', 'CONFIRMEE')
    .is('archived_at', null);

  if (departures) {
    for (const r of departures) {
      await createNotification({
        user_id: userId,
        type: 'DEPART_IMMINENT',
        titre: 'EDL départ à réaliser',
        message: `${r.locataire_prenom} ${r.locataire_nom} — départ aujourd'hui`,
        entity_type: 'reservation',
        entity_id: r.id,
      });
    }
  }
}

// ─── Point d'entrée ──────────────────────────────────────────

/** Exécute tous les sweeps de notifications */
export async function runNotificationSweeps(userId: string): Promise<void> {
  await Promise.allSettled([
    notifyExpiringSoonOptions(userId),
    notifyExpiredOptions(userId),
    notifyOverduePaiements(userId),
    notifyUpcomingPaiements(userId),
    notifyNewlyAssignedTaches(),
    notifyTachesEnRetard(userId),
    notifyArriveesDemain(userId),
    notifyDepartsDemain(userId),
    notifyEdlAReaRealiser(userId),
  ]);
}

// Export des fonctions individuelles pour les tests
export {
  notifyExpiringSoonOptions,
  notifyExpiredOptions,
  notifyOverduePaiements,
  notifyUpcomingPaiements,
  notifyNewlyAssignedTaches,
  notifyTachesEnRetard,
  notifyArriveesDemain,
  notifyDepartsDemain,
  notifyEdlAReaRealiser,
  formatDateFr,
};
