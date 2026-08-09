-- ============================================================
--  EVAD — Messagerie interne (fils de discussion entre utilisateurs)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Idempotent.
--
--  Chaque message appartient à un « fil » (thread_id) : par ex. la
--  discussion Pilote ↔ Bâtisseur autour d'une quête
--  → thread_id = 'q:<quete_id>:<batisseur_id>'.
--  Le temps réel (Supabase Realtime) pousse les nouveaux messages aux
--  participants sans rafraîchir la page.
-- ============================================================

create table if not exists public.messages (
  id           text primary key,             -- msg-<uuid>
  thread_id    text not null,                -- clé du fil (déterministe des 2 côtés)
  quete_id     text,
  lieu_id      text,
  author_id    text,                         -- id stable de l'expéditeur
  author_role  text,                         -- pilote | batisseur | semeur
  author_nom   text,
  dest_id      text,                         -- id du destinataire (notifications)
  text         text not null,
  created_at   timestamptz not null default now()
);

create index if not exists messages_thread_idx on public.messages (thread_id, created_at);

alter table public.messages enable row level security;

-- Modèle bêta : lecture/écriture publiques (comme le reste ; le verrouillage
-- par participant viendra avec le lot de sécurité).
drop policy if exists "messages_select_public" on public.messages;
create policy "messages_select_public" on public.messages for select using (true);

drop policy if exists "messages_insert_public" on public.messages;
create policy "messages_insert_public" on public.messages for insert with check (true);

-- Temps réel : ajoute la table à la publication Realtime (ignore si déjà fait).
do $$
begin
  begin
    execute 'alter publication supabase_realtime add table public.messages';
  exception when duplicate_object then null;
           when undefined_object then null;  -- publication absente : Realtime non activé
  end;
end $$;

-- ============================================================
--  Après ça : les boutons « Contacter le Pilote » / « Message » ouvrent
--  une vraie conversation persistée, en temps réel entre les utilisateurs.
-- ============================================================
