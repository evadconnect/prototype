-- ─── Persistance de la Spirale VADE (tableau de bord) ───────────────────────
-- Une ligne par (compte, profil) : l'état des tâches cochées de la spirale.
-- `done` est un tableau de tableaux de booléens (phases × tâches), sérialisé
-- côté client depuis regen-loop.js. Sécurité sur invitation (cf. mémoire
-- evad-securite-invitation) : rien n'est lisible ni modifiable hors de son
-- propre compte. À exécuter sur la base STAGING evad-dev (dev.evad.org).

create table if not exists public.vade_parcours (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  role       text        not null,
  done       jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.vade_parcours enable row level security;

-- Chacun ne lit et n'écrit que ses propres lignes (auth.uid() = user_id).
drop policy if exists "vade_parcours lecture proprietaire" on public.vade_parcours;
create policy "vade_parcours lecture proprietaire"
  on public.vade_parcours for select
  using (auth.uid() = user_id);

drop policy if exists "vade_parcours insertion proprietaire" on public.vade_parcours;
create policy "vade_parcours insertion proprietaire"
  on public.vade_parcours for insert
  with check (auth.uid() = user_id);

drop policy if exists "vade_parcours mise a jour proprietaire" on public.vade_parcours;
create policy "vade_parcours mise a jour proprietaire"
  on public.vade_parcours for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
