-- ============================================================
--  EVAD — Table des indicateurs (ICI) persistés dans Supabase
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.
--
--  Une ligne = un Indicateur de Changement d'Impact (ICI) rattaché à un lieu,
--  dérivé des solutions retenues sur ce lieu. Écrite/ré-écrite à la
--  publication de la fiche lieu (remplacement de l'ensemble des lignes du
--  lieu). Base pour agréger l'impact projeté du réseau par capital.
-- ============================================================

create table if not exists public.indicateurs (
  id         text primary key,            -- id applicatif : <lieu_id>-ici-<ici_id>
  user_id    uuid references auth.users(id) on delete cascade,
  lieu_id    text,
  ici_id     text,                        -- id du catalogue ICI (ex. eco_co2)
  nom        text,                        -- libellé de l'indicateur
  livre      text,                        -- capital : ecologie | social | economie_locale
  unite      text,                        -- unité (ex. kg CO₂e/an)
  solutions  jsonb,                       -- noms des solutions du lieu qui portent cet ICI
  donnees    jsonb,                       -- copie souple
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists indicateurs_lieu_id_idx on public.indicateurs (lieu_id);

alter table public.indicateurs enable row level security;

-- Lecture publique (comme fiche_pilote / quetes).
drop policy if exists "indicateurs_select_public" on public.indicateurs;
create policy "indicateurs_select_public" on public.indicateurs for select using (true);

-- Écriture ouverte (modèle actuel de la bêta).
drop policy if exists "indicateurs_insert_public" on public.indicateurs;
create policy "indicateurs_insert_public" on public.indicateurs for insert with check (true);

drop policy if exists "indicateurs_update_public" on public.indicateurs;
create policy "indicateurs_update_public" on public.indicateurs for update using (true) with check (true);

drop policy if exists "indicateurs_delete_public" on public.indicateurs;
create policy "indicateurs_delete_public" on public.indicateurs for delete using (true);
