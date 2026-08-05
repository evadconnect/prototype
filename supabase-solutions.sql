-- ============================================================
--  EVAD — Table des solutions (persistées dans Supabase)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.
--
--  Une ligne = une solution rattachée à un lieu. Écrite/ré-écrite à la
--  publication de la fiche lieu (le front remplace l'ensemble des lignes du
--  lieu à chaque modification). Permet d'interroger « quels lieux utilisent
--  telle solution » et d'agréger l'usage des solutions sur le réseau.
-- ============================================================

create table if not exists public.solutions (
  id         text primary key,            -- id applicatif : <lieu_id>-sol-<slug>
  user_id    uuid references auth.users(id) on delete cascade,
  lieu_id    text,
  nom        text,                        -- nom de la solution (catalogue SOLS)
  cat        text,                        -- catégorie de la solution
  espace     text,                        -- espace du lieu concerné (optionnel)
  source_ic  text,                        -- emoji / icône
  donnees    jsonb,                       -- copie souple
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists solutions_lieu_id_idx on public.solutions (lieu_id);

alter table public.solutions enable row level security;

-- Lecture publique (comme fiche_pilote / quetes).
drop policy if exists "solutions_select_public" on public.solutions;
create policy "solutions_select_public" on public.solutions for select using (true);

-- Écriture ouverte (modèle actuel de la bêta ; verrouillage par propriétaire
-- viendra avec le lot de sécurité).
drop policy if exists "solutions_insert_public" on public.solutions;
create policy "solutions_insert_public" on public.solutions for insert with check (true);

drop policy if exists "solutions_update_public" on public.solutions;
create policy "solutions_update_public" on public.solutions for update using (true) with check (true);

drop policy if exists "solutions_delete_public" on public.solutions;
create policy "solutions_delete_public" on public.solutions for delete using (true);
