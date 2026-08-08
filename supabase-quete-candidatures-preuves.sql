-- ============================================================
--  EVAD — Inscriptions des Bâtisseurs + preuves de quête (T0/T1)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.
--
--  Boucle de retour du parcours quête :
--  1. Un Bâtisseur rejoint une quête   → ligne quete_candidatures
--  2. Il dépose une preuve T0 (état initial) puis T1 (état final)
--     → lignes quete_preuves (+ photo dans le bucket « preuves »)
--  3. Le Pilote valide les preuves      → validee = true
--     Quand T0 et T1 sont validées, la quête passe statut 'terminee'
--     (colonne statut de lieu_quetes, déjà en place).
-- ============================================================

-- 1) Inscriptions des Bâtisseurs aux quêtes.
create table if not exists public.quete_candidatures (
  id             text primary key,          -- cand-<batisseurId>-<queteId>
  user_id        uuid references auth.users(id) on delete set null,
  quete_id       text not null,             -- id de lieu_quetes
  lieu_id        text,
  batisseur_id   text,
  batisseur_nom  text,
  statut         text not null default 'inscrit',  -- inscrit | retire
  donnees        jsonb,                     -- copie complète (souple)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists quete_candidatures_quete_idx
  on public.quete_candidatures (quete_id);

alter table public.quete_candidatures enable row level security;

-- Modèle bêta : lecture/écriture publiques, comme lieu_quetes
-- (le verrouillage par propriétaire viendra avec le lot de sécurité).
drop policy if exists "quete_candidatures_select_public" on public.quete_candidatures;
create policy "quete_candidatures_select_public" on public.quete_candidatures for select using (true);

drop policy if exists "quete_candidatures_insert_public" on public.quete_candidatures;
create policy "quete_candidatures_insert_public" on public.quete_candidatures for insert with check (true);

drop policy if exists "quete_candidatures_update_public" on public.quete_candidatures;
create policy "quete_candidatures_update_public" on public.quete_candidatures for update using (true) with check (true);

drop policy if exists "quete_candidatures_delete_public" on public.quete_candidatures;
create policy "quete_candidatures_delete_public" on public.quete_candidatures for delete using (true);

-- 2) Preuves déposées sur les quêtes.
create table if not exists public.quete_preuves (
  id             text primary key,          -- pv-<uuid>
  user_id        uuid references auth.users(id) on delete set null,
  quete_id       text not null,             -- id de lieu_quetes
  lieu_id        text,
  batisseur_id   text,
  batisseur_nom  text,
  phase          text not null default 't1',    -- t0 (état initial) | t1 (état final)
  type           text not null default 'photo', -- photo | mesure | temoignage
  note           text,
  valeur         text,                      -- valeur mesurée (indicateurs)
  photo_url      text,                      -- URL publique du bucket « preuves »
  validee        boolean not null default false, -- validée par le Pilote
  donnees        jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists quete_preuves_quete_idx
  on public.quete_preuves (quete_id);

alter table public.quete_preuves enable row level security;

drop policy if exists "quete_preuves_select_public" on public.quete_preuves;
create policy "quete_preuves_select_public" on public.quete_preuves for select using (true);

drop policy if exists "quete_preuves_insert_public" on public.quete_preuves;
create policy "quete_preuves_insert_public" on public.quete_preuves for insert with check (true);

drop policy if exists "quete_preuves_update_public" on public.quete_preuves;
create policy "quete_preuves_update_public" on public.quete_preuves for update using (true) with check (true);

drop policy if exists "quete_preuves_delete_public" on public.quete_preuves;
create policy "quete_preuves_delete_public" on public.quete_preuves for delete using (true);

-- 3) Bucket Storage public pour les photos de preuve (avant / après).
insert into storage.buckets (id, name, public)
values ('preuves', 'preuves', true)
on conflict (id) do nothing;

drop policy if exists "anon upload preuves" on storage.objects;
create policy "anon upload preuves"
  on storage.objects for insert to anon
  with check (bucket_id = 'preuves');

-- 4) La colonne statut de lieu_quetes accepte désormais aussi 'terminee'
--    (aucune contrainte CHECK n'existe : rien à modifier, on documente).
--    Statuts utilisés par l'app : a_verifier | ouverte | en_pause | retiree | terminee

-- ============================================================
--  Après ça : les inscriptions et preuves des Bâtisseurs sont
--  partagées entre appareils et visibles du Pilote.
--  Lire les données : Table editor → quete_candidatures / quete_preuves.
-- ============================================================
