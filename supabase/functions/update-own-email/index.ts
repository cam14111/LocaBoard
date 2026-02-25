// Edge Function : update-own-email
// Permet à un utilisateur authentifié de changer son propre email de connexion.
// Utilise la clé service_role (disponible automatiquement dans les Edge Functions)
// pour appeler auth.admin.updateUserById() — ce qui modifie auth.users immédiatement
// sans email de confirmation — et synchronise la table users en même temps.
//
// Déploiement :
//   supabase functions deploy update-own-email --project-ref <votre-project-ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405);
  }

  // ── 1. Récupérer et vérifier le JWT du demandeur ────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Non authentifié.' }, 401);
  }
  const jwt = authHeader.slice(7);

  // Client admin (service_role) — les variables sont injectées automatiquement
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Identifier l'utilisateur appelant à partir du JWT
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !user) {
    return json({ error: 'Token invalide ou expiré.' }, 401);
  }

  // ── 2. Valider le corps de la requête ────────────────────────
  let body: { newEmail?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps de requête invalide.' }, 400);
  }

  const newEmail = body.newEmail?.trim();
  if (!newEmail) {
    return json({ error: 'Le champ newEmail est requis.' }, 400);
  }

  // Validation format email (simple)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    return json({ error: 'Format d\'email invalide.' }, 400);
  }

  // Pas de changement inutile
  if (newEmail === user.email) {
    return json({ success: true, changed: false });
  }

  // ── 3. Mettre à jour auth.users (admin API, sans confirmation) ─
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { email: newEmail },
  );
  if (authUpdateError) {
    // Cas courant : email déjà utilisé par un autre compte
    const message = authUpdateError.message.includes('already')
      ? 'Cette adresse email est déjà utilisée par un autre compte.'
      : authUpdateError.message;
    return json({ error: message }, 422);
  }

  // ── 4. Synchroniser la table users (email d'affichage) ────────
  const { error: tableError } = await supabaseAdmin
    .from('users')
    .update({ email: newEmail })
    .eq('id', user.id);

  if (tableError) {
    // L'email auth.users a changé mais la table users pas —
    // on le signale sans bloquer (l'authentification est correcte).
    console.error('Sync table users échouée:', tableError.message);
  }

  return json({ success: true, changed: true });
});
