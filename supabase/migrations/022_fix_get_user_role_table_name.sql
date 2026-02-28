-- Migration 022 : Correction des fonctions RLS qui référençaient 'utilisateurs'
-- L'app utilise la table 'users' (migrations 018, 020, code API), mais les fonctions
-- get_user_role(), count_admins() et current_user_has_permission() ciblaient 'utilisateurs'.
-- Ce mismatch causait get_user_role() → NULL → policy INSERT documents échouait (HTTP 400).

SET search_path TO public;

-- Correction de get_user_role()
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() AND archived_at IS NULL;
$$;

-- Correction de count_admins()
CREATE OR REPLACE FUNCTION count_admins()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.users
  WHERE role = 'ADMIN'
    AND archived_at IS NULL;
$$;

-- Correction de current_user_has_permission()
CREATE OR REPLACE FUNCTION current_user_has_permission(perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (permissions ->> perm)::BOOLEAN
     FROM public.users
     WHERE id = auth.uid()),
    FALSE
  );
$$;
