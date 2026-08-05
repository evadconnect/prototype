-- ============================================================
--  EVAD — Renommer la table des fiches Pilote : lieux → fiche_pilote
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.  ⚠️ PROD UNIQUEMENT (ne pas lancer sur evad-dev/staging).
--
--  Le renommage conserve automatiquement les données, les politiques RLS,
--  les contraintes et les index. Le bucket Storage « lieux » n'est PAS touché.
-- ============================================================

alter table public.lieux rename to fiche_pilote;

-- Vérification :
-- select count(*) from public.fiche_pilote;
