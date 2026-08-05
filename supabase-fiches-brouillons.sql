-- ============================================================
--  EVAD — Brouillons de fiche synchronisés dans le cloud
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.
--
--  Chaque personne connectée peut sauvegarder/reprendre sa fiche en cours
--  depuis n'importe quel appareil. Une entrée par compte et par profil.
-- ============================================================

create table if not exists public.fiches_brouillons (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  kind       text        not null,          -- 'lieu' | 'batisseur' | 'semeur'
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.fiches_brouillons enable row level security;

-- Chacun ne voit et ne gère QUE ses propres brouillons.
drop policy if exists "brouillons_select_own" on public.fiches_brouillons;
create policy "brouillons_select_own" on public.fiches_brouillons
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "brouillons_insert_own" on public.fiches_brouillons;
create policy "brouillons_insert_own" on public.fiches_brouillons
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "brouillons_update_own" on public.fiches_brouillons;
create policy "brouillons_update_own" on public.fiches_brouillons
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "brouillons_delete_own" on public.fiches_brouillons;
create policy "brouillons_delete_own" on public.fiches_brouillons
  for delete to authenticated using (auth.uid() = user_id);
