-- ============================================================
--  EVAD — Renomme la table `quetes` en `lieu_quetes`
--  et ajoute les colonnes lieu_nom + adresse.
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent.
--  À lancer APRÈS avoir déployé le code qui pointe sur `lieu_quetes`
--  (les policies RLS, séquences et contraintes suivent le renommage).
-- ============================================================

-- 1. Renommage de la table (seulement si pas déjà fait).
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'quetes')
     and not exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'lieu_quetes')
  then
    execute 'alter table public.quetes rename to lieu_quetes';
  end if;
end $$;

-- 2. Colonnes nom du lieu + adresse.
alter table public.lieu_quetes add column if not exists lieu_nom text;
alter table public.lieu_quetes add column if not exists adresse  text;

-- 3. Remplissage rétroactif depuis fiche_pilote (via lieu_id).
update public.lieu_quetes q
   set lieu_nom = coalesce(q.lieu_nom, f.nom),
       adresse  = coalesce(q.adresse,  f.localisation)
  from public.fiche_pilote f
 where f.id = q.lieu_id
   and (q.lieu_nom is null or q.adresse is null);
