-- ============================================================
--  EVAD — Table des fiches Semeur / Financeur (persistées dans Supabase)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Idempotent.
--
--  Miroir de fiche_pilotes / fiche_batisseur : le profil d'un Semeur est
--  partagé (visible sur la carte par tous), retrouvé sur tous ses appareils,
--  et ré-éditable via l'écran « Ma fiche financeur » (republication).
-- ============================================================

create table if not exists public.fiche_semeur (
  id           text primary key,             -- id applicatif (uuid stable du semeur)
  user_id      uuid references auth.users(id) on delete cascade,
  nom          text,
  type         text,                          -- Entreprise | Fondation | Association | Collectivité | Particulier
  localisation text,
  zone         text,
  latitude     double precision,
  longitude    double precision,
  donnees      jsonb,                          -- copie complète de la fiche (souple)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.fiche_semeur enable row level security;

-- Lecture publique (les fiches apparaissent sur la carte communauté).
drop policy if exists "fiche_semeur_select_public" on public.fiche_semeur;
create policy "fiche_semeur_select_public" on public.fiche_semeur for select using (true);

-- Écriture ouverte (modèle actuel de la bêta, comme fiche_pilotes ;
-- le verrouillage par propriétaire viendra avec le lot de sécurité).
drop policy if exists "fiche_semeur_insert_public" on public.fiche_semeur;
create policy "fiche_semeur_insert_public" on public.fiche_semeur for insert with check (true);

drop policy if exists "fiche_semeur_update_public" on public.fiche_semeur;
create policy "fiche_semeur_update_public" on public.fiche_semeur for update using (true) with check (true);

drop policy if exists "fiche_semeur_delete_public" on public.fiche_semeur;
create policy "fiche_semeur_delete_public" on public.fiche_semeur for delete using (true);

-- ============================================================
--  Après ça : publier une fiche Semeur l'enregistre en base, elle
--  apparaît sur la carte (onglet Carte → Semeurs) et reste modifiable
--  (republier depuis « Ma fiche financeur » met à jour la même ligne).
-- ============================================================
