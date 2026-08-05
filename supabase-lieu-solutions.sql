-- ============================================================
--  EVAD — Table des solutions d'un lieu (lieu_solutions)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Rejouable sans risque.
--
--  Une ligne = une solution retenue par un lieu (à distinguer de
--  biblio_solutions, le catalogue partagé). Écrite/ré-écrite à la
--  publication de la fiche lieu : le front remplace l'ensemble des lignes
--  du lieu à chaque modification.
-- ============================================================

-- Si l'ancienne table « solutions » existe déjà, on la renomme
-- (les données sont conservées). Sans effet sinon.
alter table if exists public.solutions rename to lieu_solutions;
alter index if exists public.solutions_lieu_id_idx rename to lieu_solutions_lieu_id_idx;

create table if not exists public.lieu_solutions (
  id         text primary key,            -- id applicatif : <lieu_id>-sol-<slug>
  user_id    uuid references auth.users(id) on delete cascade,
  lieu_id    text,
  nom        text,                        -- nom de la solution (biblio_solutions)
  cat        text,                        -- catégorie de la solution
  espace     text,                        -- espace du lieu concerné (optionnel)
  source_ic  text,                        -- emoji / icône
  donnees    jsonb,                       -- copie souple
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists lieu_solutions_lieu_id_idx on public.lieu_solutions (lieu_id);

alter table public.lieu_solutions enable row level security;

-- Purge des anciennes policies (nom « solutions_* ») puis recréation.
drop policy if exists "solutions_select_public" on public.lieu_solutions;
drop policy if exists "solutions_insert_public" on public.lieu_solutions;
drop policy if exists "solutions_update_public" on public.lieu_solutions;
drop policy if exists "solutions_delete_public" on public.lieu_solutions;

-- Lecture publique (comme fiche_pilote / quetes).
drop policy if exists "lieu_solutions_select_public" on public.lieu_solutions;
create policy "lieu_solutions_select_public" on public.lieu_solutions for select using (true);

-- Écriture ouverte (modèle actuel de la bêta ; verrouillage par propriétaire
-- viendra avec le lot de sécurité).
drop policy if exists "lieu_solutions_insert_public" on public.lieu_solutions;
create policy "lieu_solutions_insert_public" on public.lieu_solutions for insert with check (true);

drop policy if exists "lieu_solutions_update_public" on public.lieu_solutions;
create policy "lieu_solutions_update_public" on public.lieu_solutions for update using (true) with check (true);

drop policy if exists "lieu_solutions_delete_public" on public.lieu_solutions;
create policy "lieu_solutions_delete_public" on public.lieu_solutions for delete using (true);
