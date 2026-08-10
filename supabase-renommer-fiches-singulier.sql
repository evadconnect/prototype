-- ============================================================
--  EVAD — Renommer les tables de fiches au singulier
--    fiche_pilotes    → fiche_pilote
--    fiche_batisseurs → fiche_batisseur
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent.
--  À lancer APRÈS avoir déployé le code qui pointe sur les noms au singulier
--  (les policies RLS, index et contraintes suivent le renommage).
--
--  ⚠️ Le code de l'app interroge désormais `fiche_pilote` et `fiche_batisseur`
--     (singulier). Ces renommages alignent la base sur le code.
-- ============================================================

-- 1) fiche_pilotes → fiche_pilote
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'fiche_pilotes')
     and not exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'fiche_pilote')
  then
    execute 'alter table public.fiche_pilotes rename to fiche_pilote';
  end if;
end $$;

-- 2) fiche_batisseurs → fiche_batisseur
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'fiche_batisseurs')
     and not exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'fiche_batisseur')
  then
    execute 'alter table public.fiche_batisseurs rename to fiche_batisseur';
  end if;
end $$;

-- (Facultatif) forcer le rechargement du cache de schéma PostgREST, si l'API
-- renvoie encore « Could not find the table ... in the schema cache » :
-- notify pgrst, 'reload schema';

-- Vérification :
-- select count(*) from public.fiche_pilote;
-- select count(*) from public.fiche_batisseur;
