-- ============================================================================
--  Récolte — Migration du modèle de données (ex « offres_mkt »)
-- ----------------------------------------------------------------------------
--  Renomme, SANS RIEN SUPPRIMER, la table et les colonnes du module :
--    offres_mkt   -> recolte_acces
--    prix         -> graines_cost   (graines pour déverrouiller)
--    stock        -> places
--    stock_max    -> places_max
--  + ajoute la colonne booléenne hors_exploitation (garde-fou), reprise depuis
--    la copie JSON « donnees » quand elle existe.
--
--  100 % réversible : voir supabase-recolte-rollback.sql
--  Idempotent : relançable sans risque (chaque étape est conditionnelle).
--  À exécuter dans Supabase → SQL Editor (base DEV d'abord).
-- ============================================================================

begin;

-- 1) Renommer la table (seulement si l'ancienne existe et la nouvelle pas encore)
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='offres_mkt')
     and not exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='recolte_acces') then
    execute 'alter table public.offres_mkt rename to recolte_acces';
  end if;
end $$;

-- 2) Renommer les colonnes (chacune seulement si l'ancien nom est encore là)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='recolte_acces' and column_name='prix') then
    execute 'alter table public.recolte_acces rename column prix to graines_cost';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='recolte_acces' and column_name='stock') then
    execute 'alter table public.recolte_acces rename column stock to places';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='recolte_acces' and column_name='stock_max') then
    execute 'alter table public.recolte_acces rename column stock_max to places_max';
  end if;
end $$;

-- 3) Colonne garde-fou (idempotent), reprise depuis donnees.hors_exploitation
alter table public.recolte_acces
  add column if not exists hors_exploitation boolean not null default false;

update public.recolte_acces
   set hors_exploitation = case lower(coalesce(donnees->>'hors_exploitation',''))
                             when 'true' then true when 't' then true when '1' then true
                             else false end
 where (donnees->>'hors_exploitation') is not null;

-- 4) Renommer les index (cosmétique, sans échec si déjà fait)
alter index if exists offres_mkt_lieu_idx   rename to recolte_acces_lieu_idx;
alter index if exists offres_mkt_statut_idx  rename to recolte_acces_statut_idx;

-- 5) Realtime : garder la table publiée (elle l'était sous l'ancien nom)
do $$
begin
  alter publication supabase_realtime add table public.recolte_acces;
exception when duplicate_object then null; end $$;

commit;

-- ── Vérification ──
-- select id, lieu_nom, titre, cat, graines_cost, places, places_max,
--        hors_exploitation, statut
--   from public.recolte_acces order by created_at desc;
