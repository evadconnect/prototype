-- ============================================================
--  EVAD — Produits / offres du Marché (Marketplace) partagés
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent.
--
--  Une offre est un bien ou service payable en graines, publié par un Pilote
--  pour son lieu. Persistée ici, elle est visible et achetable par tous les
--  membres (bâtisseurs, réseau) sur n'importe quel appareil, et retrouvée par
--  le Pilote dans « Marché » de son tableau de bord.
--
--  RLS publique (modèle bêta) ; le verrouillage par propriétaire viendra avec
--  le lot de sécurité.
-- ============================================================

create table if not exists public.offres_mkt (
  id           text primary key,             -- id applicatif de l'offre
  user_id      uuid references auth.users(id) on delete set null,
  lieu_id      text,                          -- lieu vendeur (fiche_pilote.id)
  lieu_nom     text,
  titre        text,
  cat          text,                          -- alimentation | formation | service | location | ...
  prix         integer default 0,             -- coût en graines (0 = gratuit)
  stock        integer default 0,
  stock_max    integer default 0,
  emoji        text,
  description  text,
  statut       text default 'active',         -- active | paused | full
  vues         integer default 0,
  echanges     integer default 0,
  donnees      jsonb,                          -- copie complète (souple)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists offres_mkt_lieu_idx   on public.offres_mkt (lieu_id);
create index if not exists offres_mkt_statut_idx on public.offres_mkt (statut);

alter table public.offres_mkt enable row level security;
drop policy if exists "offres_mkt_select_public" on public.offres_mkt;
create policy "offres_mkt_select_public" on public.offres_mkt for select using (true);
drop policy if exists "offres_mkt_insert_public" on public.offres_mkt;
create policy "offres_mkt_insert_public" on public.offres_mkt for insert with check (true);
drop policy if exists "offres_mkt_update_public" on public.offres_mkt;
create policy "offres_mkt_update_public" on public.offres_mkt for update using (true) with check (true);
drop policy if exists "offres_mkt_delete_public" on public.offres_mkt;
create policy "offres_mkt_delete_public" on public.offres_mkt for delete using (true);

-- Realtime : les offres apparaissent/évoluent en direct pour les acheteurs.
do $$ begin
  alter publication supabase_realtime add table public.offres_mkt;
exception when duplicate_object then null; end $$;

-- ── Vérification ──
-- select id, lieu_nom, titre, prix, stock, statut from public.offres_mkt order by created_at desc;
