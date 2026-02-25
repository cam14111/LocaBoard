// Parse les erreurs RPC Supabase et retourne des messages utilisateur en français

// Codes métier levés par les RPC custom
const RPC_CODE_MAP: Record<string, string> = {
  CONFLIT_DATES: 'Les dates sont en conflit avec une réservation existante.',
  CONFLIT_BLOCAGE: 'Le créneau est bloqué pour cette période.',
  TAMPON_MENAGE: 'Tampon ménage insuffisant entre les séjours.',
};

// Patterns Supabase/PostgreSQL génériques → messages lisibles
const SUPABASE_PATTERN_MAP: [RegExp, string][] = [
  [/in the schema cache/i, 'Fonction serveur introuvable — la migration n\'est pas encore appliquée.'],
  [/violates foreign key constraint/i, 'Référence invalide — vérifiez que toutes les données liées existent.'],
  [/violates unique constraint/i, 'Ces données existent déjà (doublon détecté).'],
  [/violates not-null constraint/i, 'Un champ obligatoire est manquant.'],
  [/permission denied/i, 'Accès refusé — vérifiez vos permissions.'],
  [/JWT expired/i, 'Session expirée — veuillez vous reconnecter.'],
  [/relation .* does not exist/i, 'Table introuvable — vérifiez que la migration est appliquée.'],
  [/could not find the function/i, 'Fonction serveur introuvable — la migration n\'est pas encore appliquée.'],
  [/failed to fetch/i, 'Impossible de joindre le serveur — vérifiez votre connexion.'],
  [/network/i, 'Erreur réseau — vérifiez votre connexion.'],
];

export function parseRpcError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Une erreur inattendue est survenue.';

  const msg = (error as { message?: string }).message ?? '';

  // 1. Codes métier custom (levés par nos RPC)
  for (const [code, label] of Object.entries(RPC_CODE_MAP)) {
    if (msg.includes(code)) return label;
  }

  // 2. Patterns Supabase/PostgreSQL génériques
  for (const [pattern, label] of SUPABASE_PATTERN_MAP) {
    if (pattern.test(msg)) return label;
  }

  // 3. Fallback court : message brut tronqué à 120 caractères
  if (msg) {
    return msg.length > 120 ? msg.slice(0, 120) + '…' : msg;
  }

  return 'Une erreur inattendue est survenue.';
}
