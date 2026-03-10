import { supabase } from '@/lib/supabase';
import { createAuditLog } from './audit';
import type { LogementPiece, TypePiece } from '@/types/database.types';

/** Récupère les pièces d'un logement, triées par ordre */
export async function getLogementPieces(logementId: string): Promise<LogementPiece[]> {
  const { data, error } = await supabase
    .from('logement_pieces')
    .select('*')
    .eq('logement_id', logementId)
    .order('ordre');

  if (error) throw error;
  return data as LogementPiece[];
}

/** Remplace toutes les pièces d'un logement (delete + insert) */
export async function upsertLogementPieces(
  logementId: string,
  pieces: Array<{ nom: string; type_piece: TypePiece; ordre: number }>,
): Promise<LogementPiece[]> {
  // Supprimer les pièces existantes
  const { error: deleteError } = await supabase
    .from('logement_pieces')
    .delete()
    .eq('logement_id', logementId);

  if (deleteError) throw deleteError;

  if (pieces.length === 0) return [];

  // Insérer les nouvelles
  const rows = pieces.map((p) => ({
    logement_id: logementId,
    nom: p.nom,
    type_piece: p.type_piece,
    ordre: p.ordre,
  }));

  const { data, error } = await supabase
    .from('logement_pieces')
    .insert(rows)
    .select();

  if (error) throw error;

  await createAuditLog({
    entity_type: 'logement',
    entity_id: logementId,
    logement_id: logementId,
    action: 'pieces_updated',
    metadata: { nb_pieces: pieces.length },
  });

  return data as LogementPiece[];
}

/** Génère la liste de pièces par défaut (logique pure, pas d'I/O) */
export function generateDefaultPieces(
  nbChambres: number,
  nbSdb: number,
): Array<{ nom: string; type_piece: TypePiece; ordre: number }> {
  const pieces: Array<{ nom: string; type_piece: TypePiece; ordre: number }> = [];
  let ordre = 0;

  // Cuisine (toujours)
  pieces.push({ nom: 'Cuisine', type_piece: 'CUISINE', ordre: ordre++ });
  // Séjour (toujours)
  pieces.push({ nom: 'Séjour', type_piece: 'SEJOUR', ordre: ordre++ });

  // Chambres
  for (let i = 1; i <= nbChambres; i++) {
    pieces.push({
      nom: nbChambres === 1 ? 'Chambre' : `Chambre ${i}`,
      type_piece: 'CHAMBRE',
      ordre: ordre++,
    });
  }

  // Salles de bain
  for (let i = 1; i <= nbSdb; i++) {
    pieces.push({
      nom: nbSdb === 1 ? 'Salle de bain' : `Salle de bain ${i}`,
      type_piece: 'SALLE_DE_BAIN',
      ordre: ordre++,
    });
  }

  return pieces;
}

/**
 * Ajustement intelligent des pièces quand nb_chambres ou nb_sdb change.
 * Retourne les nouvelles pièces sans I/O.
 */
export function adjustPiecesForCount(
  existingPieces: Array<{ nom: string; type_piece: TypePiece; ordre: number }>,
  typePiece: 'CHAMBRE' | 'SALLE_DE_BAIN',
  oldCount: number,
  newCount: number,
): { pieces: Array<{ nom: string; type_piece: TypePiece; ordre: number }>; removed: string[] } {
  const label = typePiece === 'CHAMBRE' ? 'Chambre' : 'Salle de bain';
  const pieces = [...existingPieces];
  const removed: string[] = [];

  if (newCount > oldCount) {
    // Ajouter les nouvelles pièces à la fin
    const maxOrdre = pieces.length > 0 ? Math.max(...pieces.map((p) => p.ordre)) : -1;
    for (let i = oldCount + 1; i <= newCount; i++) {
      pieces.push({
        nom: `${label} ${i}`,
        type_piece: typePiece,
        ordre: maxOrdre + (i - oldCount),
      });
    }
  } else if (newCount < oldCount) {
    // Supprimer les dernières pièces du type correspondant
    const piecesOfType = pieces.filter((p) => p.type_piece === typePiece);
    const toRemove = piecesOfType.slice(newCount);
    for (const p of toRemove) {
      removed.push(p.nom);
      const idx = pieces.indexOf(p);
      if (idx >= 0) pieces.splice(idx, 1);
    }
  }

  return { pieces, removed };
}
