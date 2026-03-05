-- Migration 036: Corrige les documents remplacés dont archived_at est NULL
-- Cas apparu car la policy RLS UPDATE était manquante (corrigée en 035).
-- Archive rétroactivement tout document référencé par remplace_document_id
-- d'un autre document mais dont archived_at n'a pas été positionné.

UPDATE public.documents
SET archived_at = now()
WHERE id IN (
  SELECT remplace_document_id
  FROM public.documents
  WHERE remplace_document_id IS NOT NULL
)
AND archived_at IS NULL;
