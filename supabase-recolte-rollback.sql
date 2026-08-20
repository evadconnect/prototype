-- ============================================================================
--  Récolte — ROLLBACK de la migration (revenir à « offres_mkt »)
-- ----------------------------------------------------------------------------
--  Annule supabase-recolte-migration.sql. Ne supprime aucune donnée : renomme
--  simplement en sens inverse. La colonne hors_exploitation est conservée dans
--  « donnees » avant d'être retirée, pour ne rien perdre.
--  Idempotent. À n'exécuter que si tu veux revenir en arrière.
-- ============================================================================

begin;

-- 1) Sauver hors_exploitation dans donnees puis retirer la colonne
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='recolte_acces' and column_name='hors_exploitation') then
    execute $q$
      update public.recolte_acces
         set donnees = coalesce(donnees,'{}'::jsonb)
                       || jsonb_build_object('hors_exploitation', hors_exploitation)
    $q$;
    execute 'alter table public.recolte_acces drop column hors_exploitation';
  end if;
end $$;

-- 2) Renommer les colonnes en sens inverse
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='recolte_acces' and column_name='graines_cost') then
    execute 'alter table public.recolte_acces rename column graines_cost to prix';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='recolte_acces' and column_name='places') then
    execute 'alter table public.recolte_acces rename column places to stock';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='recolte_acces' and column_name='places_max') then
    execute 'alter table public.recolte_acces rename column places_max to stock_max';
  end if;
end $$;

-- 3) Renommer les index en sens inverse
alter index if exists recolte_acces_lieu_idx   rename to offres_mkt_lieu_idx;
alter index if exists recolte_acces_statut_idx  rename to offres_mkt_statut_idx;

-- 4) Renommer la table en sens inverse
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='recolte_acces')
     and not exists (select 1 from information_schema.tables
             where table_schema='public' and table_name='offres_mkt') then
    execute 'alter table public.recolte_acces rename to offres_mkt';
  end if;
end $$;

commit;
