/**
 * Utilitaires pour la tarification saisonnière.
 *
 * Modèle 3 saisons : Basse, Haute, Très haute.
 * La haute saison = complément (tout ce qui n'est ni basse ni très haute).
 * Les dates sont au format MM-DD pour cyclicité annuelle.
 */

// ─── Types ────────────────────────────────────────────────────

export interface SaisonConfig {
  nom_saison: string;
  loyer_nuit: number;
  loyer_semaine: number | null;
  date_debut: string; // MM-DD
  date_fin: string;   // MM-DD
  ordre: number;
}

export interface RentBreakdownLine {
  nom_saison: string;
  nuits: number;
  tarif_nuit: number;
  tarif_semaine: number | null;
  montant: number;
}

export interface RentResult {
  total: number;
  breakdown: RentBreakdownLine[];
  totalNuits: number;
}

// ─── Constantes ───────────────────────────────────────────────

export const SAISON_BASSE = 'Basse saison';
export const SAISON_HAUTE = 'Haute saison';
export const SAISON_TRES_HAUTE = 'Très haute saison';

// ─── Valeurs par défaut ───────────────────────────────────────

export function getDefaultSaisons(): SaisonConfig[] {
  return [
    {
      nom_saison: SAISON_BASSE,
      loyer_nuit: 0,
      loyer_semaine: null,
      date_debut: '10-15',
      date_fin: '04-15',
      ordre: 0,
    },
    {
      nom_saison: SAISON_HAUTE,
      loyer_nuit: 0,
      loyer_semaine: null,
      date_debut: '', // calculé dynamiquement
      date_fin: '',   // calculé dynamiquement
      ordre: 1,
    },
    {
      nom_saison: SAISON_TRES_HAUTE,
      loyer_nuit: 0,
      loyer_semaine: null,
      date_debut: '07-01',
      date_fin: '09-01',
      ordre: 2,
    },
  ];
}

// ─── Utilitaires MM-DD ────────────────────────────────────────

/** Convertit une Date en 'MM-DD' */
export function toMMDD(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

/** Convertit MM-DD en jour de l'année (1-366) pour comparaisons */
function mmddToDay(mmdd: string): number {
  const [m, d] = mmdd.split('-').map(Number);
  // Approximation : mois de 31 jours pour simplifier les comparaisons
  // Utilise une année non-bissextile de référence
  const ref = new Date(2024, m - 1, d); // 2024 est bissextile = safe
  const jan1 = new Date(2024, 0, 1);
  return Math.floor((ref.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/** Vérifie si un MM-DD tombe dans l'intervalle [debut, fin[ (supporte cross-année) */
export function isMMDDInRange(mmdd: string, debut: string, fin: string): boolean {
  if (debut === fin) return false;

  const d = mmddToDay(mmdd);
  const s = mmddToDay(debut);
  const e = mmddToDay(fin);

  if (s < e) {
    // Intervalle normal (ex: 04-15 → 07-01)
    return d >= s && d < e;
  } else {
    // Intervalle cross-année (ex: 10-15 → 04-15)
    return d >= s || d < e;
  }
}

// ─── Calcul des périodes haute saison ─────────────────────────

/**
 * Calcule les périodes de la haute saison (complément de basse + très haute).
 * Retourne 0, 1 ou 2 segments sous forme de paires [debut, fin] en MM-DD.
 */
export function computeHauteSaisonPeriods(
  basse: { date_debut: string; date_fin: string },
  tresHaute: { date_debut: string; date_fin: string },
): Array<{ debut: string; fin: string }> {
  // Haute saison = ce qui reste entre :
  //   fin de basse → début de très haute
  //   fin de très haute → début de basse
  const segments: Array<{ debut: string; fin: string }> = [];

  // Segment 1 : fin basse → début très haute
  if (basse.date_fin !== tresHaute.date_debut) {
    segments.push({ debut: basse.date_fin, fin: tresHaute.date_debut });
  }

  // Segment 2 : fin très haute → début basse
  if (tresHaute.date_fin !== basse.date_debut) {
    segments.push({ debut: tresHaute.date_fin, fin: basse.date_debut });
  }

  return segments;
}

// ─── Validation ───────────────────────────────────────────────

/**
 * Valide la configuration des saisons.
 * Retourne null si OK, un message d'erreur sinon.
 */
export function validateSaisons(saisons: SaisonConfig[]): string | null {
  const basse = saisons.find((s) => s.nom_saison === SAISON_BASSE);
  const tresHaute = saisons.find((s) => s.nom_saison === SAISON_TRES_HAUTE);
  const haute = saisons.find((s) => s.nom_saison === SAISON_HAUTE);

  if (!basse || !tresHaute || !haute) {
    return 'Les 3 saisons (Basse, Haute, Très haute) sont requises.';
  }

  // Vérifier que basse et très haute ont des dates
  if (!basse.date_debut || !basse.date_fin) {
    return 'Les dates de la basse saison sont requises.';
  }
  if (!tresHaute.date_debut || !tresHaute.date_fin) {
    return 'Les dates de la très haute saison sont requises.';
  }

  // Vérifier que basse et très haute ne se chevauchent pas
  // Test : est-ce que le début de très haute tombe dans la basse ?
  if (isMMDDInRange(tresHaute.date_debut, basse.date_debut, basse.date_fin)) {
    return 'La très haute saison chevauche la basse saison.';
  }
  if (isMMDDInRange(tresHaute.date_fin, basse.date_debut, basse.date_fin)) {
    return 'La très haute saison chevauche la basse saison.';
  }
  // Et inversement
  if (isMMDDInRange(basse.date_debut, tresHaute.date_debut, tresHaute.date_fin)) {
    return 'La basse saison chevauche la très haute saison.';
  }

  // Vérifier que les tarifs sont > 0
  for (const s of saisons) {
    if (s.loyer_nuit <= 0) {
      return `Le tarif par nuit de "${s.nom_saison}" doit être supérieur à 0.`;
    }
  }

  // Vérifier que la haute saison a au moins un segment
  const segments = computeHauteSaisonPeriods(basse, tresHaute);
  if (segments.length === 0) {
    return 'La basse saison et la très haute saison couvrent toute l\'année — pas de place pour la haute saison.';
  }

  return null;
}

// ─── Détermination de la saison pour une date ─────────────────

/**
 * Retourne la saison applicable pour une date donnée.
 * La haute saison est déduite comme complément de basse + très haute.
 */
export function getSaisonForDate(
  date: Date,
  saisons: SaisonConfig[],
): SaisonConfig {
  const mmdd = toMMDD(date);

  const basse = saisons.find((s) => s.nom_saison === SAISON_BASSE)!;
  const tresHaute = saisons.find((s) => s.nom_saison === SAISON_TRES_HAUTE)!;
  const haute = saisons.find((s) => s.nom_saison === SAISON_HAUTE)!;

  // Tester basse saison
  if (basse.date_debut && basse.date_fin && isMMDDInRange(mmdd, basse.date_debut, basse.date_fin)) {
    return basse;
  }

  // Tester très haute saison
  if (tresHaute.date_debut && tresHaute.date_fin && isMMDDInRange(mmdd, tresHaute.date_debut, tresHaute.date_fin)) {
    return tresHaute;
  }

  // Sinon c'est de la haute saison
  return haute;
}

// ─── Calcul du loyer ──────────────────────────────────────────

/**
 * Calcule le loyer total pour une réservation.
 * - Si le séjour total >= 7 nuits, applique le tarif semaine au prorata global.
 * - Si < 7 nuits, applique le tarif nuit par saison.
 */
export function computeRent(
  dateDebut: string, // YYYY-MM-DD
  dateFin: string,   // YYYY-MM-DD
  saisons: SaisonConfig[],
): RentResult {
  if (!dateDebut || !dateFin || saisons.length === 0) {
    return { total: 0, breakdown: [], totalNuits: 0 };
  }

  const start = new Date(dateDebut);
  const end = new Date(dateFin);
  const totalNuits = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (totalNuits <= 0) {
    return { total: 0, breakdown: [], totalNuits: 0 };
  }

  // Compter les nuits par saison
  const nuitsBySaison = new Map<string, number>();
  const current = new Date(start);

  for (let i = 0; i < totalNuits; i++) {
    const saison = getSaisonForDate(current, saisons);
    nuitsBySaison.set(saison.nom_saison, (nuitsBySaison.get(saison.nom_saison) ?? 0) + 1);
    current.setDate(current.getDate() + 1);
  }

  // Calculer le montant par saison
  const useWeeklyRate = totalNuits >= 7;
  const breakdown: RentBreakdownLine[] = [];
  let total = 0;

  for (const saison of saisons) {
    const nuits = nuitsBySaison.get(saison.nom_saison) ?? 0;
    if (nuits === 0) continue;

    let montant: number;

    if (useWeeklyRate && saison.loyer_semaine != null && saison.loyer_semaine > 0) {
      const semaines = Math.floor(nuits / 7);
      const reste = nuits % 7;
      montant = semaines * saison.loyer_semaine + reste * saison.loyer_nuit;
    } else {
      montant = nuits * saison.loyer_nuit;
    }

    montant = Math.round(montant * 100) / 100;
    total += montant;

    breakdown.push({
      nom_saison: saison.nom_saison,
      nuits,
      tarif_nuit: saison.loyer_nuit,
      tarif_semaine: saison.loyer_semaine,
      montant,
    });
  }

  total = Math.round(total * 100) / 100;

  return { total, breakdown, totalNuits };
}

/**
 * Calcul du loyer avec fallback sur les tarifs par défaut du logement
 * (quand aucune saison n'est configurée).
 */
export function computeRentWithFallback(
  dateDebut: string,
  dateFin: string,
  saisons: SaisonConfig[],
  fallback: { loyer_nuit_defaut: number | null; loyer_semaine_defaut: number | null },
): RentResult {
  // Si des saisons sont configurées, les utiliser
  if (saisons.length > 0) {
    return computeRent(dateDebut, dateFin, saisons);
  }

  // Sinon, fallback sur les tarifs par défaut
  if (!fallback.loyer_nuit_defaut || fallback.loyer_nuit_defaut <= 0) {
    return { total: 0, breakdown: [], totalNuits: 0 };
  }

  const start = new Date(dateDebut);
  const end = new Date(dateFin);
  const totalNuits = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (totalNuits <= 0) {
    return { total: 0, breakdown: [], totalNuits: 0 };
  }

  let montant: number;
  const useWeekly = totalNuits >= 7 && fallback.loyer_semaine_defaut != null && fallback.loyer_semaine_defaut > 0;

  if (useWeekly) {
    const semaines = Math.floor(totalNuits / 7);
    const reste = totalNuits % 7;
    montant = semaines * fallback.loyer_semaine_defaut! + reste * fallback.loyer_nuit_defaut;
  } else {
    montant = totalNuits * fallback.loyer_nuit_defaut;
  }

  montant = Math.round(montant * 100) / 100;

  return {
    total: montant,
    breakdown: [{
      nom_saison: 'Tarif standard',
      nuits: totalNuits,
      tarif_nuit: fallback.loyer_nuit_defaut,
      tarif_semaine: fallback.loyer_semaine_defaut,
      montant,
    }],
    totalNuits,
  };
}
