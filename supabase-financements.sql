-- ============================================================================
--  EVAD — Table « financements » : engagements des Semeurs sur les quêtes
--
--  Pourquoi : jusqu'ici cette table n'existait QUE dans le navigateur (liste
--  locale du store, sans synchronisation). Conséquence : un engagement pris
--  par un Semeur ne quittait pas son appareil, personne d'autre ne le voyait,
--  et le « reste à financer » d'une quête valait toujours son budget entier.
--
--  Le budget d'une quête, lui, voyage déjà : il est saisi par le Pilote et
--  transporté dans la colonne « donnees » de lieu_quetes, sans migration.
--  Reste à financer = budget − somme des financements de cette quête.
--
--  ⚠️ STAGING D'ABORD (evad-dev, mpoyfsisbaggvpdpajfo), puis la PROD.
--  Le modèle d'accès suit supabase-securite-invitation.sql : lecture pour les
--  comptes connectés, écriture réservée au propriétaire de la ligne.
-- ============================================================================

create table if not exists public.financements (
  id          text primary key,                       -- id applicatif (fin-<semeur>-<quete>)
  user_id     uuid references auth.users(id) on delete cascade,
  quete_id    text,
  lieu_id     text,
  semeur_id   text,                                   -- id de la fiche Semeur
  semeur_nom  text,
  montant     int not null default 0 check (montant >= 0),
  statut      text not null default 'engage'
              check (statut in ('engage','verse','annule')),
  donnees     jsonb,                                  -- copie complète, souple
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists financements_quete_idx  on public.financements (quete_id);
create index if not exists financements_semeur_idx on public.financements (semeur_id);
create index if not exists financements_user_idx   on public.financements (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Accès : même modèle que le reste du contenu partagé.
--   lecture   : tout compte connecté (le Pilote doit voir qui finance ses
--               quêtes, le Semeur ce que d'autres ont déjà engagé)
--   création  : tout compte connecté
--   modif/suppression : le propriétaire de la ligne uniquement
--   anon      : rien
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.financements enable row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'financements' loop
    execute format('drop policy if exists %I on public.financements', pol.policyname);
  end loop;
end $$;

create policy "lecture invites" on public.financements
  for select to authenticated using (true);

create policy "creation invites" on public.financements
  for insert to authenticated with check (true);

create policy "modification proprietaire" on public.financements
  for update to authenticated
  using (user_id::text = auth.uid()::text)
  with check (user_id::text = auth.uid()::text);

create policy "suppression proprietaire" on public.financements
  for delete to authenticated
  using (user_id::text = auth.uid()::text);

revoke all on public.financements from anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- Contrôle
-- ─────────────────────────────────────────────────────────────────────────────
select c.relname as table_, c.relrowsecurity as rls_active, count(p.polname) as nb_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relname = 'financements'
group by 1, 2;

-- Reste à financer par quête, une fois des lignes présentes.
-- select q.id, q.titre, (q.donnees->>'budget')::int as budget,
--        coalesce(sum(f.montant), 0) as engage,
--        greatest(0, coalesce((q.donnees->>'budget')::int, 0) - coalesce(sum(f.montant), 0)) as restant
--   from public.lieu_quetes q
--   left join public.financements f on f.quete_id = q.id and f.statut <> 'annule'
--  group by q.id, q.titre, q.donnees
--  order by restant desc;
