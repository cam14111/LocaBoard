-- Migration 031 : Table document_shares pour les liens de partage courts (email)
-- Chaque entrée associe un UUID court à un storage_path de document.
-- L'Edge Function doc-redirect utilise cet UUID pour générer une URL signée fraîche.

CREATE TABLE public.document_shares (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT       NOT NULL,
  created_by  UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;

-- Lecture publique : l'UUID fait office de jeton d'accès
CREATE POLICY "Public read document_shares"
  ON public.document_shares FOR SELECT
  USING (true);

-- Insertion réservée aux utilisateurs authentifiés
CREATE POLICY "Auth insert document_shares"
  ON public.document_shares FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
