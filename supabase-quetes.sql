-- ============================================================
--  EVAD — Table des quêtes (persistées dans Supabase)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.
--
--  Les quêtes deviennent partagées : un Pilote les retrouve sur tous ses
--  appareils, et les quêtes « ouvertes » peuvent circuler dans le réseau.
-- ============================================================

create table if not exists public.quetes (
  id         text primary key,            -- id applicatif (ex. <lieu>-sol-...)
  user_id    uuid references auth.users(id) on delete cascade,
  lieu_id    text,
  titre      text,
  duree      text,
  nb         text,
  graines    int  default 50,
  impact     text,
  source     text,                        -- solution d'origine (nom)
  source_ic  text,
  statut     text default 'a_verifier',   -- a_verifier | ouverte | retiree
  custom     boolean default false,       -- créée manuellement vs issue d'une solution
  donnees    jsonb,                        -- copie complète (souple)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.quetes enable row level security;

-- Lecture publique (le front filtre les 'ouverte' pour le réseau ; le
-- Pilote voit ses propres quêtes de tout statut).
drop policy if exists "quetes_select_public" on public.quetes;
create policy "quetes_select_public" on public.quetes for select using (true);

-- Écriture ouverte (modèle actuel de la bêta, comme fiche_pilotes ;
-- le verrouillage par propriétaire viendra avec le lot de sécurité).
drop policy if exists "quetes_insert_public" on public.quetes;
create policy "quetes_insert_public" on public.quetes for insert with check (true);

drop policy if exists "quetes_update_public" on public.quetes;
create policy "quetes_update_public" on public.quetes for update using (true) with check (true);

drop policy if exists "quetes_delete_public" on public.quetes;
create policy "quetes_delete_public" on public.quetes for delete using (true);
