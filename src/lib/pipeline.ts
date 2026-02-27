// Règles de transition du pipeline dossier
import type { PipelineStatut } from '@/types/database.types';

// Matrice des transitions autorisées : statut → statuts suivants
const FORWARD_TRANSITIONS: Record<PipelineStatut, PipelineStatut[]> = {
  DEMANDE_RECUE: [], // Statut legacy — plus utilisé à la création
  OPTION_POSEE: ['CONTRAT_ENVOYE'],
  CONTRAT_ENVOYE: ['CONTRAT_SIGNE'],
  CONTRAT_SIGNE: ['ACOMPTE_RECU'],
  ACOMPTE_RECU: ['SOLDE_DEMANDE'],
  SOLDE_DEMANDE: ['SOLDE_RECU', 'CHECKIN_FAIT'],
  SOLDE_RECU: ['CHECKIN_FAIT'],
  CHECKIN_FAIT: ['EDL_ENTREE_OK', 'EDL_ENTREE_INCIDENT'],
  EDL_ENTREE_OK: ['CHECKOUT_FAIT'],
  EDL_ENTREE_INCIDENT: ['CHECKOUT_FAIT'],
  CHECKOUT_FAIT: ['EDL_OK', 'EDL_INCIDENT'],
  EDL_OK: ['CLOTURE'],
  EDL_INCIDENT: ['CLOTURE'],
  CLOTURE: [],
  ANNULE: [],
};

// Ordre linéaire principal (pour le stepper visuel)
// Note : DEMANDE_RECUE est un statut legacy, il n'est plus utilisé à la création
export const PIPELINE_STEPS: PipelineStatut[] = [
  'OPTION_POSEE',
  'CONTRAT_ENVOYE',
  'CONTRAT_SIGNE',
  'ACOMPTE_RECU',
  'SOLDE_DEMANDE',
  'SOLDE_RECU',
  'CHECKIN_FAIT',
  'EDL_ENTREE_OK',
  'CHECKOUT_FAIT',
  'EDL_OK',
  'CLOTURE',
];

export const PIPELINE_LABELS: Record<PipelineStatut, string> = {
  DEMANDE_RECUE: 'Demande reçue (legacy)',
  OPTION_POSEE: 'Option posée',
  CONTRAT_ENVOYE: 'Contrat envoyé',
  CONTRAT_SIGNE: 'Contrat signé',
  ACOMPTE_RECU: 'Acompte reçu',
  SOLDE_DEMANDE: 'Solde demandé',
  SOLDE_RECU: 'Solde reçu',
  CHECKIN_FAIT: 'Check-in fait',
  EDL_ENTREE_OK: 'EDL entrée OK',
  EDL_ENTREE_INCIDENT: 'EDL entrée incident',
  CHECKOUT_FAIT: 'Check-out fait',
  EDL_OK: 'EDL sortie OK',
  EDL_INCIDENT: 'EDL sortie incident',
  CLOTURE: 'Clôturé',
  ANNULE: 'Annulé',
};

export const PIPELINE_COLORS: Record<PipelineStatut, string> = {
  DEMANDE_RECUE: 'bg-slate-50 text-slate-400',  // legacy — style atténué
  OPTION_POSEE: 'bg-amber-100 text-amber-700',
  CONTRAT_ENVOYE: 'bg-blue-100 text-blue-700',
  CONTRAT_SIGNE: 'bg-blue-100 text-blue-700',
  ACOMPTE_RECU: 'bg-green-100 text-green-700',
  SOLDE_DEMANDE: 'bg-orange-100 text-orange-700',
  SOLDE_RECU: 'bg-green-100 text-green-700',
  CHECKIN_FAIT: 'bg-emerald-100 text-emerald-700',
  EDL_ENTREE_OK: 'bg-green-100 text-green-700',
  EDL_ENTREE_INCIDENT: 'bg-red-100 text-red-700',
  CHECKOUT_FAIT: 'bg-emerald-100 text-emerald-700',
  EDL_OK: 'bg-green-100 text-green-700',
  EDL_INCIDENT: 'bg-red-100 text-red-700',
  CLOTURE: 'bg-slate-200 text-slate-700',
  ANNULE: 'bg-red-100 text-red-700',
};

// Étapes admin only (co-hôte ne peut pas avancer)
const ADMIN_ONLY_STEPS: Set<PipelineStatut> = new Set([
  'CONTRAT_ENVOYE',
  'CONTRAT_SIGNE',
  'ACOMPTE_RECU',
  'SOLDE_DEMANDE',
  'SOLDE_RECU',
  'CLOTURE',
]);

// Étapes opérationnelles (admin + co-hôte)
// CHECKIN_FAIT, EDL_ENTREE_OK, EDL_ENTREE_INCIDENT, CHECKOUT_FAIT, EDL_OK, EDL_INCIDENT

export type UserPipelineRole = 'ADMIN' | 'COHOTE';

/** Transitions possibles depuis un statut donné */
export function getNextSteps(current: PipelineStatut): PipelineStatut[] {
  return FORWARD_TRANSITIONS[current] || [];
}

/** Vérifie si l'utilisateur peut avancer vers un statut donné */
export function canAdvance(
  current: PipelineStatut,
  target: PipelineStatut,
  role: UserPipelineRole,
): boolean {
  const allowed = FORWARD_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) return false;
  if (ADMIN_ONLY_STEPS.has(target) && role !== 'ADMIN') return false;
  return true;
}

/** Vérifie si l'utilisateur peut reculer d'une étape (admin uniquement) */
export function canRevert(current: PipelineStatut, role: UserPipelineRole): PipelineStatut | null {
  if (role !== 'ADMIN') return null;
  if (current === 'CLOTURE' || current === 'ANNULE') return null;

  // Les variantes _INCIDENT ne sont pas dans PIPELINE_STEPS — traitement explicite
  if (current === 'EDL_INCIDENT') return 'CHECKOUT_FAIT';
  if (current === 'EDL_ENTREE_INCIDENT') return 'CHECKIN_FAIT';

  const idx = PIPELINE_STEPS.indexOf(current);
  if (idx <= 0) return null;

  return PIPELINE_STEPS[idx - 1];
}

/** Vérifie si un dossier peut être annulé (tout sauf CLOTURE) */
export function canCancel(current: PipelineStatut): boolean {
  return current !== 'CLOTURE' && current !== 'ANNULE';
}

/** Index du statut dans le stepper (pour affichage visuel) */
export function getStepIndex(statut: PipelineStatut): number {
  // Les statuts _INCIDENT se positionnent visuellement au même niveau que leur équivalent _OK
  let lookup: PipelineStatut = statut;
  if (statut === 'EDL_INCIDENT') lookup = 'EDL_OK';
  if (statut === 'EDL_ENTREE_INCIDENT') lookup = 'EDL_ENTREE_OK';
  const idx = PIPELINE_STEPS.indexOf(lookup);
  return idx >= 0 ? idx : -1;
}
