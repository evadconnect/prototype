-- ============================================================
--  EVAD — Table des fiches Bâtisseur (persistées dans Supabase)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Idempotent.
--
--  Miroir de fiche_pilote : le profil d'un Bâtisseur est partagé (visible
--  sur la carte par tous), retrouvé sur tous ses appareils, et éditable
--  depuis le tableau de bord (onglet « Ma fiche »).
-- ============================================================

create table if not exists public.fiche_batisseur (
  id          text primary key,              -- id applicatif (uuid stable du bâtisseur)
  user_id     uuid references auth.users(id) on delete cascade,
  prenom      text,
  nom         text,
  ville       text,
  latitude    double precision,
  longitude   double precision,
  bio         text,
  competences jsonb,                          -- liste des ids de compétences
  donnees     jsonb,                          -- copie complète de la fiche (souple)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Rattrapage : si la table existait déjà avec un schéma incomplet (ancienne
-- version / renommage), on garantit la présence de TOUTES les colonnes.
-- (create table if not exists n'ajoute pas les colonnes manquantes.)
alter table public.fiche_batisseur add column if not exists user_id     uuid;
alter table public.fiche_batisseur add column if not exists prenom      text;
alter table public.fiche_batisseur add column if not exists nom         text;
alter table public.fiche_batisseur add column if not exists ville       text;
alter table public.fiche_batisseur add column if not exists latitude    double precision;
alter table public.fiche_batisseur add column if not exists longitude   double precision;
alter table public.fiche_batisseur add column if not exists bio         text;
alter table public.fiche_batisseur add column if not exists competences jsonb;
alter table public.fiche_batisseur add column if not exists donnees     jsonb;
alter table public.fiche_batisseur add column if not exists created_at  timestamptz default now();
alter table public.fiche_batisseur add column if not exists updated_at  timestamptz default now();

alter table public.fiche_batisseur enable row level security;

-- Lecture publique (les fiches apparaissent sur la carte communauté).
drop policy if exists "fiche_batisseur_select_public" on public.fiche_batisseur;
create policy "fiche_batisseur_select_public" on public.fiche_batisseur for select using (true);

-- Écriture ouverte (modèle actuel de la bêta, comme fiche_pilote ;
-- le verrouillage par propriétaire viendra avec le lot de sécurité).
drop policy if exists "fiche_batisseur_insert_public" on public.fiche_batisseur;
create policy "fiche_batisseur_insert_public" on public.fiche_batisseur for insert with check (true);

drop policy if exists "fiche_batisseur_update_public" on public.fiche_batisseur;
create policy "fiche_batisseur_update_public" on public.fiche_batisseur for update using (true) with check (true);

drop policy if exists "fiche_batisseur_delete_public" on public.fiche_batisseur;
create policy "fiche_batisseur_delete_public" on public.fiche_batisseur for delete using (true);

-- Force PostgREST à recharger le schéma (sinon l'API renvoie encore
-- « Could not find the 'bio' column ... in the schema cache »).
notify pgrst, 'reload schema';

-- ============================================================
--  Après ça : publier une fiche Bâtisseur l'enregistre en base, elle
--  apparaît sur la carte (onglet Carte → Bâtisseurs) et reste modifiable
--  depuis le tableau de bord (onglet « Ma fiche »).
-- ============================================================
