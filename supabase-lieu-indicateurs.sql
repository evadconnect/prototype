-- ============================================================
--  EVAD — Table des indicateurs (ICI) d'un lieu (lieu_indicateurs)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Rejouable sans risque.
--
--  Une ligne = un Indicateur de Changement d'Impact (ICI) rattaché à un
--  lieu, dérivé des solutions retenues sur ce lieu (à distinguer de
--  biblio_indicateurs, le référentiel partagé). Écrite/ré-écrite à la
--  publication de la fiche lieu (remplacement de l'ensemble des lignes).
-- ============================================================

-- Si l'ancienne table « indicateurs » existe déjà, on la renomme
-- (les données sont conservées). Sans effet sinon.
alter table if exists public.indicateurs rename to lieu_indicateurs;
alter index if exists public.indicateurs_lieu_id_idx rename to lieu_indicateurs_lieu_id_idx;

create table if not exists public.lieu_indicateurs (
  id         text primary key,            -- id applicatif : <lieu_id>-ici-<ici_id>
  user_id    uuid references auth.users(id) on delete cascade,
  lieu_id    text,
  ici_id     text,                        -- id du référentiel ICI (ex. eco_co2)
  nom        text,                        -- libellé de l'indicateur
  livre      text,                        -- capital : ecologie | social | economie_locale
  unite      text,                        -- unité (ex. kg CO₂e/an)
  solutions  jsonb,                       -- noms des solutions du lieu qui portent cet ICI
  donnees    jsonb,                       -- copie souple
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists lieu_indicateurs_lieu_id_idx on public.lieu_indicateurs (lieu_id);

alter table public.lieu_indicateurs enable row level security;

-- Purge des anciennes policies (nom « indicateurs_* ») puis recréation.
drop policy if exists "indicateurs_select_public" on public.lieu_indicateurs;
drop policy if exists "indicateurs_insert_public" on public.lieu_indicateurs;
drop policy if exists "indicateurs_update_public" on public.lieu_indicateurs;
drop policy if exists "indicateurs_delete_public" on public.lieu_indicateurs;

-- Lecture publique (comme fiche_pilote / quetes).
drop policy if exists "lieu_indicateurs_select_public" on public.lieu_indicateurs;
create policy "lieu_indicateurs_select_public" on public.lieu_indicateurs for select using (true);

-- Écriture ouverte (modèle actuel de la bêta).
drop policy if exists "lieu_indicateurs_insert_public" on public.lieu_indicateurs;
create policy "lieu_indicateurs_insert_public" on public.lieu_indicateurs for insert with check (true);

drop policy if exists "lieu_indicateurs_update_public" on public.lieu_indicateurs;
create policy "lieu_indicateurs_update_public" on public.lieu_indicateurs for update using (true) with check (true);

drop policy if exists "lieu_indicateurs_delete_public" on public.lieu_indicateurs;
create policy "lieu_indicateurs_delete_public" on public.lieu_indicateurs for delete using (true);
