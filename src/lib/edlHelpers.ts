import type { EdlItem, EdlStatut } from '@/types/database.types';

/** Calcule le nombre d'items renseignés (etat !== null) */
export function countCompleted(items: EdlItem[]): number {
  return items.filter((i) => i.etat !== null).length;
}

/** Calcule le pourcentage de progression (0-100) */
export function computeProgress(items: EdlItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((countCompleted(items) / items.length) * 100);
}

/** Détermine si l'EDL doit passer à EN_COURS (premier item renseigné) */
export function shouldStartEdl(currentStatut: EdlStatut, items: EdlItem[]): boolean {
  return currentStatut === 'NON_COMMENCE' && countCompleted(items) > 0;
}

/** Détermine si l'EDL est finalisé (lecture seule) */
export function isEdlFinalized(statut: EdlStatut): boolean {
  return statut === 'TERMINE_OK' || statut === 'TERMINE_INCIDENT';
}

/** Détermine si tous les items sont renseignés (peut finaliser) */
export function canFinalize(items: EdlItem[]): boolean {
  if (items.length === 0) return false;
  return items.every((i) => i.etat !== null);
}

/** Vérifie si au moins un item est en anomalie */
export function hasAnomalies(items: EdlItem[]): boolean {
  return items.some((i) => i.etat === 'ANOMALIE');
}

/** Compte les anomalies */
export function countAnomalies(items: EdlItem[]): number {
  return items.filter((i) => i.etat === 'ANOMALIE').length;
}

/** Détermine le statut final après finalisation */
export function getFinalStatut(items: EdlItem[]): 'TERMINE_OK' | 'TERMINE_INCIDENT' {
  return hasAnomalies(items) ? 'TERMINE_INCIDENT' : 'TERMINE_OK';
}

/** Détermine le label du bouton d'action pour un EDL */
export function getEdlActionLabel(statut: EdlStatut): 'Commencer' | 'Reprendre' | 'Voir le détail' {
  if (isEdlFinalized(statut)) return 'Voir le détail';
  if (statut === 'EN_COURS') return 'Reprendre';
  return 'Commencer';
}

/** Trie les items par ordre */
export function sortItemsByOrdre(items: EdlItem[]): EdlItem[] {
  return [...items].sort((a, b) => a.ordre - b.ordre);
}
