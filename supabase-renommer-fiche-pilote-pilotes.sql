-- ============================================================
--  EVAD — Renomme la table des fiches Pilote : fiche_pilote → fiche_pilotes
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent.
--  À lancer APRÈS avoir déployé le code qui pointe sur `fiche_pilotes`
--  (les policies RLS, séquences, contraintes et index suivent le renommage ;
--  le bucket Storage « lieux » n'est PAS touché).
-- ============================================================

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'fiche_pilote')
     and not exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'fiche_pilotes')
  then
    execute 'alter table public.fiche_pilote rename to fiche_pilotes';
  end if;
end $$;

-- Vérification :
-- select count(*) from public.fiche_pilotes;
