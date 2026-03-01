// Edge Function : doc-redirect
// Reçoit un UUID de partage, génère une URL signée fraîche et redirige vers le document.
// Accessible sans authentification (l'UUID agit comme jeton d'accès).
//
// Déploiement :
//   supabase functions deploy doc-redirect --project-ref <project-ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const shareId = url.searchParams.get('id');

  if (!shareId) {
    return new Response('Lien invalide.', { status: 400, headers: CORS_HEADERS });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // Récupérer le storage_path associé à cet UUID de partage
  const { data: share, error } = await supabaseAdmin
    .from('document_shares')
    .select('storage_path')
    .eq('id', shareId)
    .single();

  if (error || !share) {
    return new Response('Lien introuvable.', { status: 404, headers: CORS_HEADERS });
  }

  // Générer une URL signée fraîche (1 heure suffit car on redirige immédiatement)
  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from('documents')
    .createSignedUrl(share.storage_path, 3600);

  if (signError || !signed) {
    return new Response('Impossible de générer le lien.', { status: 500, headers: CORS_HEADERS });
  }

  return new Response(null, {
    status: 302,
    headers: {
      ...CORS_HEADERS,
      'Location': signed.signedUrl,
    },
  });
});
