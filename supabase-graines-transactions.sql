-- ============================================================
--  EVAD — Économie des graines (monnaie) : grand livre + escrow Marketplace
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent.
--
--  graines_tx        : grand livre. Une ligne = un mouvement signé (delta)
--                      rattaché à un profil (party_type + party_id). Le solde
--                      d'un profil = somme des delta.
--  mkt_transactions  : échanges Marketplace en double validation (escrow).
--                      Un achat crée une ligne « en_attente » (graines de
--                      l'acheteur bloquées) ; le vendeur confirme la remise
--                      → « confirmee » (transfert via graines_tx).
--
--  RLS publique (modèle bêta, comme les autres tables) ; le verrouillage par
--  propriétaire viendra avec le lot de sécurité.
-- ============================================================

-- ── Grand livre des graines ──────────────────────────────────
create table if not exists public.graines_tx (
  id          text primary key,
  user_id     uuid references auth.users(id) on delete set null,
  party_type  text,                 -- pilote | batisseur | semeur
  party_id    text,                 -- id du lieu / bâtisseur / semeur
  delta       integer not null default 0,   -- mouvement signé (+ crédit, - débit)
  type        text,                 -- welcome | quete | vente | achat | reservation | financement | injection | ajustement
  label       text,
  ref_table   text,
  ref_id      text,
  donnees     jsonb,
  created_at  timestamptz default now()
);

create index if not exists graines_tx_party_idx on public.graines_tx (party_type, party_id);

alter table public.graines_tx enable row level security;
drop policy if exists "graines_tx_select_public" on public.graines_tx;
create policy "graines_tx_select_public" on public.graines_tx for select using (true);
drop policy if exists "graines_tx_insert_public" on public.graines_tx;
create policy "graines_tx_insert_public" on public.graines_tx for insert with check (true);
drop policy if exists "graines_tx_update_public" on public.graines_tx;
create policy "graines_tx_update_public" on public.graines_tx for update using (true) with check (true);
drop policy if exists "graines_tx_delete_public" on public.graines_tx;
create policy "graines_tx_delete_public" on public.graines_tx for delete using (true);

-- ── Transactions Marketplace (escrow) ────────────────────────
create table if not exists public.mkt_transactions (
  id           text primary key,
  user_id      uuid references auth.users(id) on delete set null,
  offer_id     text,
  offer_titre  text,
  prix         integer not null default 0,
  buyer_type   text,
  buyer_id     text,
  buyer_nom    text,
  seller_type  text,
  seller_id    text,
  seller_nom   text,
  code         text,                -- code de retrait à 4 chiffres (indice en plus de l'escrow)
  statut       text default 'en_attente',   -- en_attente | confirmee | annulee
  donnees      jsonb,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists mkt_tx_buyer_idx  on public.mkt_transactions (buyer_type, buyer_id);
create index if not exists mkt_tx_seller_idx on public.mkt_transactions (seller_type, seller_id);
create index if not exists mkt_tx_statut_idx on public.mkt_transactions (statut);

alter table public.mkt_transactions enable row level security;
drop policy if exists "mkt_tx_select_public" on public.mkt_transactions;
create policy "mkt_tx_select_public" on public.mkt_transactions for select using (true);
drop policy if exists "mkt_tx_insert_public" on public.mkt_transactions;
create policy "mkt_tx_insert_public" on public.mkt_transactions for insert with check (true);
drop policy if exists "mkt_tx_update_public" on public.mkt_transactions;
create policy "mkt_tx_update_public" on public.mkt_transactions for update using (true) with check (true);
drop policy if exists "mkt_tx_delete_public" on public.mkt_transactions;
create policy "mkt_tx_delete_public" on public.mkt_transactions for delete using (true);

-- Realtime (pour que vendeur/acheteur voient l'échange évoluer en direct).
-- Ignore l'erreur si déjà dans la publication.
do $$ begin
  alter publication supabase_realtime add table public.graines_tx;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.mkt_transactions;
exception when duplicate_object then null; end $$;

-- ── Vérification ──
-- select party_type, party_id, sum(delta) as solde from public.graines_tx group by 1,2;
-- select id, offer_titre, prix, buyer_nom, seller_nom, statut from public.mkt_transactions order by created_at desc;
