-- ============================================================
--  EVAD — Sélection des inscrits bêta (table inscription_beta)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Ajoute un statut À CHOIX (menu déroulant) pour
--  choisir à qui on ouvre la bêta.
-- ============================================================

-- 1. Type « à choix » : le Table Editor affichera un menu déroulant
--    avec ces 3 valeurs (au lieu d'un champ texte libre).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'statut_inscription') then
    create type statut_inscription as enum ('nouveau', 'approuvé', 'compte_créé');
  end if;
end $$;

-- 2. Colonne statut (crée si absente, sinon convertit le texte existant).
alter table public.inscription_beta
  add column if not exists statut statut_inscription;

alter table public.inscription_beta alter column statut drop default;

alter table public.inscription_beta
  alter column statut type statut_inscription
  using (coalesce(nullif(statut::text, ''), 'nouveau')::statut_inscription);

update public.inscription_beta set statut = 'nouveau' where statut is null;

alter table public.inscription_beta alter column statut set default 'nouveau';
alter table public.inscription_beta alter column statut set not null;

-- 3. Date de création du compte (renseignée par la fonction).
alter table public.inscription_beta
  add column if not exists compte_cree_at timestamptz;

-- ─────────────────────────────────────────────────────────────
-- MODE D'EMPLOI (équipe) :
--   1. Table Editor → inscription_beta → colonne `statut`.
--   2. Clique la cellule : un MENU DÉROULANT propose
--      nouveau / approuvé / compte_créé. Choisis « approuvé »
--      pour les personnes à qui ouvrir la bêta.
--   3. Page d'admin → « Créer les comptes approuvés ».
--   La fonction passe ensuite la ligne à « compte_créé » (ignorée après).
-- ─────────────────────────────────────────────────────────────

-- (facultatif) voir l'état des inscriptions :
-- select statut, count(*) from public.inscription_beta group by statut;
