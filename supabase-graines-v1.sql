-- ============================================================================
--  EVAD — Les Graines, spécification fonctionnelle v1 (août 2026)
--  Socle de données et séquence de frappe.
--
--  ⚠️ À VALIDER PAR PIERRE avant tout déploiement : la spécification le demande
--  deux fois, et ce fichier est une PROPOSITION de schéma, pas un acquis.
--
--  ⚠️ STAGING D'ABORD, et pour l'instant STAGING SEULEMENT :
--  projet evad-dev (mpoyfsisbaggvpdpajfo). Le front n'expose ces écrans que
--  hors production, comme le reste des nouveautés en cours d'essai.
--
--  Écart assumé avec le §4 : les Edge Functions Deno ne sont pas déployables
--  d'ici. La règle « aucun calcul côté client, aucune écriture directe depuis
--  le front » est tenue autrement, et strictement : les tables n'accordent
--  AUCUN droit d'écriture aux rôles anon et authenticated ; tout passe par des
--  fonctions « security definer » appelées en RPC. Le basculement vers des Edge
--  Functions plus tard ne changera pas le schéma.
--
--  Ce fichier ne touche pas à l'économie existante (graines_tx,
--  mkt_transactions, offres_mkt) : les tables site_graines_* vivent à côté,
--  le temps que la v1 soit éprouvée.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tables de référence (§2.2) — déterministes, jamais générées
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ref_ampleur_acte (
  code    text primary key,
  libelle text not null,
  valeur  numeric not null check (valeur > 0)
);

create table if not exists public.ref_niveau_preuve (
  code    text primary key,
  libelle text not null,
  facteur numeric not null check (facteur > 0 and facteur <= 1)
);

create table if not exists public.ref_degressivite (
  id   int primary key,
  bmin numeric not null,
  bmax numeric,                       -- null = tranche ouverte
  coef numeric not null check (coef > 0 and coef <= 1)
);

insert into public.ref_ampleur_acte (code, libelle, valeur) values
  ('simple', 'Intervention ponctuelle', 15),
  ('etendu', 'Session de contribution', 30),
  ('engage', 'Cycle ou coordination',   60)
on conflict (code) do update set libelle = excluded.libelle, valeur = excluded.valeur;

insert into public.ref_niveau_preuve (code, libelle, facteur) values
  ('declaratif',   'Déclaré',               0.25),
  ('documentaire', 'Documenté',             0.50),
  ('pairs',        'Vérifié par les pairs', 0.75),
  ('audit_tiers',  'Audité',                1.00)
on conflict (code) do update set libelle = excluded.libelle, facteur = excluded.facteur;

insert into public.ref_degressivite (id, bmin, bmax, coef) values
  (1,   0,  100, 1.00),
  (2, 100,  200, 0.50),
  (3, 200, null, 0.25)
on conflict (id) do update set bmin = excluded.bmin, bmax = excluded.bmax, coef = excluded.coef;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Constantes (§2.3) — en table, pour être relevées sans redéploiement
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ref_graines_constante (
  cle    text primary key,
  valeur numeric not null,
  note   text
);

insert into public.ref_graines_constante (cle, valeur, note) values
  ('PEREQUATION_TAUX',       0.08, 'Part de chaque frappe versée au pot commun'),
  ('PLAFOND_FRAPPE_ANNUEL',  1200, 'Frappe cumulée maximale par personne et par an'),
  ('PLAFOND_DETENTION',       600, 'Solde disponible maximal'),
  ('BONUS_ACCUEIL',            10, 'Gelé à la signature de la Charte, activé au premier acte validé'),
  ('DOTATION_AMORCAGE',      5000, 'Écriture unique, non reconductible, isolée du calcul d''impact'),
  ('FONTE_TAUX',                0, 'Désactivée : cadran de réserve')
on conflict (cle) do update set valeur = excluded.valeur, note = excluded.note;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Modèle de données (§3)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.site_graines_solde (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  disponible   int not null default 0 check (disponible >= 0),
  gele         int not null default 0 check (gele >= 0),
  cumul_annuel int not null default 0 check (cumul_annuel >= 0),
  annee        int not null default extract(year from now()),
  updated_at   timestamptz not null default now()
);

create table if not exists public.site_graines_acte (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  lieu_id            text,
  canal              text not null check (canal in ('A','B')),
  ici_id             text,                                        -- canal A
  ampleur_code       text references public.ref_ampleur_acte(code),
  -- Marqueur du capital social : c'est lui qui rend le témoin obligatoire.
  -- ⚠️ La spécification nomme la règle sans nommer la colonne : à trancher
  -- avec Pierre. Ici on la porte explicitement plutôt que de la déduire de
  -- l'ICI, pour que la contrainte soit vérifiable en base.
  capital_social     boolean not null default false,
  points_base        numeric not null check (points_base >= 0),
  niveau_preuve_code text not null references public.ref_niveau_preuve(code),
  facteur_applique   numeric,
  brut               numeric,
  coef_degressivite  numeric,
  net_frappe         int,
  perequation        int,
  credit             int,
  statut             text not null default 'propose'
                     check (statut in ('propose','realise','valide','rejete')),
  valide_par         uuid references auth.users(id),
  temoin_id          uuid references auth.users(id),
  preuves            jsonb not null default '[]'::jsonb,
  frappe_le          timestamptz,                                  -- idempotence de la frappe
  created_at         timestamptz not null default now(),
  validated_at       timestamptz,
  -- §5 : un acte du capital social ne peut être validé sans témoin, et le
  -- témoin ne peut pas être le contributeur. En base, pas seulement dans l'app.
  constraint temoin_obligatoire_si_capital_social check (
    statut <> 'valide' or capital_social = false
    or (temoin_id is not null and temoin_id <> user_id)
  ),
  -- Canal A porte un ICI, canal B une ampleur.
  constraint canal_coherent check (
    (canal = 'A' and ici_id is not null) or (canal = 'B' and ampleur_code is not null)
  )
);
create index if not exists site_graines_acte_user_idx on public.site_graines_acte (user_id, created_at desc);

create table if not exists public.site_graines_transaction (
  id               uuid primary key default gen_random_uuid(),
  from_id          uuid references auth.users(id),
  to_id            uuid references auth.users(id),
  montant          int not null check (montant > 0),
  type             text not null check (type in ('frappe','acces','flechage','perequation','amorcage')),
  contrepartie_id  uuid,
  motif            text,
  created_at       timestamptz not null default now()
);
create index if not exists site_graines_tx_from_idx on public.site_graines_transaction (from_id, created_at desc);
create index if not exists site_graines_tx_to_idx   on public.site_graines_transaction (to_id, created_at desc);

create table if not exists public.site_graines_pot (
  id         uuid primary key default gen_random_uuid(),
  solde      int not null,          -- solde du pot APRÈS le mouvement
  mouvement  int not null,
  motif      text not null check (motif in ('perequation','accueil','equilibrage','amorcage')),
  lieu_id    text,
  created_at timestamptz not null default now()
);

create table if not exists public.site_appel_contribution (
  id                uuid primary key default gen_random_uuid(),
  lieu_id           text not null,
  titre             text not null,
  description       text,
  canal             text not null check (canal in ('A','B')),
  ampleur_code      text references public.ref_ampleur_acte(code),
  ici_id            text,
  -- §3 : case obligatoire, elle engage le Pilote. Un appel qui relève de
  -- l'exploitation du lieu n'a rien à faire ici.
  hors_exploitation boolean not null default false,
  periode_debut     date,
  periode_fin       date,
  statut            text not null default 'ouvert'
                    check (statut in ('brouillon','ouvert','clos','annule')),
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  constraint periode_large check (periode_fin is null or periode_debut is null or periode_fin >= periode_debut)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Accès : lecture seule pour les comptes, écriture réservée aux fonctions
--
-- C'est ce bloc qui tient l'invariant « aucune écriture depuis le front ».
-- Aucune policy insert/update/delete n'est créée : même un compte connecté ne
-- peut que LIRE. Les fonctions de la section 5 écrivent en security definer.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.site_graines_solde        enable row level security;
alter table public.site_graines_acte         enable row level security;
alter table public.site_graines_transaction  enable row level security;
alter table public.site_graines_pot          enable row level security;
alter table public.site_appel_contribution   enable row level security;
alter table public.ref_ampleur_acte          enable row level security;
alter table public.ref_niveau_preuve         enable row level security;
alter table public.ref_degressivite          enable row level security;
alter table public.ref_graines_constante     enable row level security;

do $$
declare t text;
begin
  -- Barèmes : lisibles par tout compte connecté, l'interface doit pouvoir
  -- expliquer un calcul (§7 : afficher ce qu'un cran de preuve rapporterait).
  foreach t in array array['ref_ampleur_acte','ref_niveau_preuve','ref_degressivite','ref_graines_constante'] loop
    execute format('drop policy if exists "bareme lisible" on public.%I', t);
    execute format('create policy "bareme lisible" on public.%I for select to authenticated using (true)', t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
  end loop;

  -- Mon solde, mes actes, mes transactions.
  drop policy if exists "mon solde" on public.site_graines_solde;
  create policy "mon solde" on public.site_graines_solde for select to authenticated using (user_id = auth.uid());

  drop policy if exists "mes actes" on public.site_graines_acte;
  create policy "mes actes" on public.site_graines_acte for select to authenticated
    using (user_id = auth.uid() or valide_par = auth.uid() or temoin_id = auth.uid());

  drop policy if exists "mes transactions" on public.site_graines_transaction;
  create policy "mes transactions" on public.site_graines_transaction for select to authenticated
    using (from_id = auth.uid() or to_id = auth.uid());

  -- Le pot commun est un bien commun : son état est public aux membres.
  drop policy if exists "pot commun lisible" on public.site_graines_pot;
  create policy "pot commun lisible" on public.site_graines_pot for select to authenticated using (true);

  drop policy if exists "appels lisibles" on public.site_appel_contribution;
  create policy "appels lisibles" on public.site_appel_contribution for select to authenticated using (true);

  foreach t in array array['site_graines_solde','site_graines_acte','site_graines_transaction','site_graines_pot','site_appel_contribution'] loop
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. La séquence de frappe (§2.4)
--
-- Vérifiée contre les jeux de test du §9 avant écriture :
--   simple/déclaré → brut 3.75, net 4 · étendu/audité → brut 30, crédit 28
--   mois de Karim (45+15+22+4) → brut 86, net 86, péréquation 7, crédit 79
--   260 bruts → net 165, péréquation 13, crédit 152
--   cumul 1190 + acte 60 → frappe tronquée à 10, tronquée et journalisée
--   solde 590, crédit 40 → crédit tronqué à 10, surplus au pot
-- ─────────────────────────────────────────────────────────────────────────────

-- Dégressivité MARGINALE : chaque tranche du cumul du mois porte son coefficient.
create or replace function public.graines_degressivite(p_cumul_avant numeric, p_brut numeric)
returns numeric language plpgsql immutable as $$
declare r record; pos numeric := p_cumul_avant; reste numeric := p_brut; net numeric := 0; haut numeric; dans numeric;
begin
  for r in select bmin, bmax, coef from public.ref_degressivite order by bmin loop
    haut := coalesce(r.bmax, 'infinity'::numeric);
    if pos >= haut then continue; end if;
    dans := least(reste, haut - greatest(pos, r.bmin));
    if dans > 0 then net := net + dans * r.coef; pos := pos + dans; reste := reste - dans; end if;
    exit when reste <= 0;
  end loop;
  return net;
end $$;

-- Frappe d'un acte validé. Idempotente sur l'acte : rejouer l'appel ne crée
-- pas de seconde frappe. Écriture atomique solde + pot + journal (§2.4.8).
create or replace function public.graines_frappe(p_acte_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a record; f numeric; base numeric; brut numeric; cumul_mois numeric;
  net_num numeric; net int; per int; credit int;
  reste_annuel int; reste_detention int; au_pot int := 0;
  tronq_annuel boolean := false; tronq_detention boolean := false;
  s record; taux numeric; pl_frappe int; pl_det int; pot_solde int;
begin
  select * into a from public.site_graines_acte where id = p_acte_id for update;
  if not found then raise exception 'Acte introuvable : %', p_acte_id; end if;
  if a.statut <> 'valide' then raise exception 'Acte non validé (statut %)', a.statut; end if;
  if a.frappe_le is not null then
    return jsonb_build_object('deja_frappe', true, 'acte_id', a.id, 'credit', a.credit);
  end if;
  if a.capital_social and (a.temoin_id is null or a.temoin_id = a.user_id) then
    raise exception 'Acte du capital social sans témoin distinct : aucune frappe';
  end if;

  select valeur into taux      from public.ref_graines_constante where cle = 'PEREQUATION_TAUX';
  select valeur into pl_frappe from public.ref_graines_constante where cle = 'PLAFOND_FRAPPE_ANNUEL';
  select valeur into pl_det    from public.ref_graines_constante where cle = 'PLAFOND_DETENTION';
  select facteur into f from public.ref_niveau_preuve where code = a.niveau_preuve_code;

  -- Canal A : points ICI portés par points_base. Canal B : valeur d'ampleur.
  if a.canal = 'B' then
    select valeur into base from public.ref_ampleur_acte where code = a.ampleur_code;
    base := coalesce(base, a.points_base);
  else
    base := a.points_base;
  end if;

  brut := base * f;

  -- Cumul BRUT du mois en cours, actes déjà frappés seulement.
  select coalesce(sum(brut), 0) into cumul_mois
    from public.site_graines_acte
   where user_id = a.user_id and frappe_le is not null
     and date_trunc('month', frappe_le) = date_trunc('month', now());

  net_num := public.graines_degressivite(cumul_mois, brut);
  net := round(net_num);

  insert into public.site_graines_solde (user_id) values (a.user_id) on conflict (user_id) do nothing;
  select * into s from public.site_graines_solde where user_id = a.user_id for update;

  -- Année civile : le cumul annuel se remet à zéro au changement d'année.
  if s.annee <> extract(year from now())::int then
    update public.site_graines_solde set cumul_annuel = 0, annee = extract(year from now())::int
     where user_id = a.user_id;
    select * into s from public.site_graines_solde where user_id = a.user_id for update;
  end if;

  reste_annuel := greatest(0, pl_frappe::int - s.cumul_annuel);
  if net > reste_annuel then net := reste_annuel; tronq_annuel := true; end if;

  per := round(net * taux);
  credit := net - per;
  au_pot := per;

  reste_detention := greatest(0, pl_det::int - s.disponible);
  if credit > reste_detention then
    au_pot := au_pot + (credit - reste_detention);
    credit := reste_detention;
    tronq_detention := true;
  end if;

  update public.site_graines_solde
     set disponible = disponible + credit,
         cumul_annuel = cumul_annuel + net,
         updated_at = now()
   where user_id = a.user_id;

  update public.site_graines_acte
     set facteur_applique = f, brut = brut,
         coef_degressivite = case when brut > 0 then net_num / brut else 1 end,
         net_frappe = net, perequation = per, credit = credit, frappe_le = now()
   where id = a.id;

  if credit > 0 then
    insert into public.site_graines_transaction (from_id, to_id, montant, type, contrepartie_id, motif)
    values (null, a.user_id, credit, 'frappe', a.id, 'Reconnaissance d''un acte régénérateur');
  end if;

  if au_pot > 0 then
    select coalesce(solde, 0) into pot_solde from public.site_graines_pot order by created_at desc limit 1;
    insert into public.site_graines_pot (solde, mouvement, motif, lieu_id)
    values (coalesce(pot_solde, 0) + au_pot, au_pot, 'perequation', a.lieu_id);
    insert into public.site_graines_transaction (from_id, to_id, montant, type, contrepartie_id, motif)
    values (a.user_id, null, au_pot, 'perequation', a.id, 'Part au pot commun');
  end if;

  -- §2.4 : toute troncature est journalisée ET rendue à l'appelant, pour que
  -- l'interface la dise. Jamais de plafond silencieux.
  return jsonb_build_object(
    'acte_id', a.id, 'brut', brut, 'net', net, 'perequation', per, 'credit', credit,
    'au_pot', au_pot, 'tronque_plafond_annuel', tronq_annuel,
    'tronque_plafond_detention', tronq_detention,
    'cumul_annuel', s.cumul_annuel + net, 'plafond_annuel', pl_frappe,
    'disponible', s.disponible + credit, 'plafond_detention', pl_det
  );
end $$;

-- Bonus d'accueil : gelé à la signature de la Charte, activé au premier acte
-- validé. Idempotent par compte.
create or replace function public.graines_activer_bonus_accueil()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s record; bonus int; a_un_acte boolean; pot_solde int;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select valeur::int into bonus from public.ref_graines_constante where cle = 'BONUS_ACCUEIL';
  insert into public.site_graines_solde (user_id, gele) values (uid, bonus) on conflict (user_id) do nothing;
  select * into s from public.site_graines_solde where user_id = uid for update;
  if s.gele <= 0 then return jsonb_build_object('active', false, 'motif', 'Aucun bonus gelé'); end if;

  select exists (select 1 from public.site_graines_acte
                  where user_id = uid and statut = 'valide' and frappe_le is not null) into a_un_acte;
  if not a_un_acte then
    return jsonb_build_object('active', false, 'motif', 'Le bonus s''active au premier acte validé', 'gele', s.gele);
  end if;

  update public.site_graines_solde set disponible = disponible + s.gele, gele = 0, updated_at = now()
   where user_id = uid;
  insert into public.site_graines_transaction (from_id, to_id, montant, type, motif)
  values (null, uid, s.gele, 'frappe', 'Bonus d''accueil activé');
  select coalesce(solde, 0) into pot_solde from public.site_graines_pot order by created_at desc limit 1;
  insert into public.site_graines_pot (solde, mouvement, motif)
  values (coalesce(pot_solde, 0) - s.gele, -s.gele, 'accueil');
  return jsonb_build_object('active', true, 'montant', s.gele);
end $$;

-- Déverrouillage d'un accès (§6) : on débite le contributeur, on crédite le
-- lieu, on trace. Ce n'est pas un paiement : aucun prix, aucun bien, un droit
-- ouvert par le lieu. Le barème d'accès vit dans ref_acces.
create table if not exists public.ref_acces (
  code    text primary key,
  libelle text not null,
  cout    int not null check (cout > 0)
);
insert into public.ref_acces (code, libelle, cout) values
  ('atelier',        'Participation à un atelier entre membres',   40),
  ('outillage',      'Emprunt d''outillage partagé',               25),
  ('espace',         'Accès à un espace ou équipement commun',     30),
  ('accompagnement', 'Accompagnement par un membre expérimenté',   50),
  ('hebergement',    'Hébergement lors d''un chantier collectif',  60),
  ('sejour',         'Place dans un séjour du réseau',            200)
on conflict (code) do update set libelle = excluded.libelle, cout = excluded.cout;
alter table public.ref_acces enable row level security;
drop policy if exists "bareme acces lisible" on public.ref_acces;
create policy "bareme acces lisible" on public.ref_acces for select to authenticated using (true);
revoke insert, update, delete on public.ref_acces from anon, authenticated;

create or replace function public.graines_debloquer_acces(p_code text, p_lieu_id text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s record; c record; tx_id uuid;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into c from public.ref_acces where code = p_code;
  if not found then raise exception 'Accès inconnu : %', p_code; end if;
  select * into s from public.site_graines_solde where user_id = uid for update;
  if not found or s.disponible < c.cout then
    return jsonb_build_object('ouvert', false, 'motif', 'Solde insuffisant',
                              'requis', c.cout, 'disponible', coalesce(s.disponible, 0));
  end if;
  update public.site_graines_solde set disponible = disponible - c.cout, updated_at = now() where user_id = uid;
  insert into public.site_graines_transaction (from_id, to_id, montant, type, motif)
  values (uid, null, c.cout, 'acces', c.libelle) returning id into tx_id;
  return jsonb_build_object('ouvert', true, 'acces', c.libelle, 'montant', c.cout,
                            'transaction_id', tx_id, 'disponible', s.disponible - c.cout);
end $$;

-- Seules ces fonctions sont appelables depuis le front.
revoke all on function public.graines_frappe(uuid) from public, anon;
grant execute on function public.graines_activer_bonus_accueil() to authenticated;
grant execute on function public.graines_debloquer_acces(text, text) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Reste à faire, volontairement absent de ce fichier
--   - redistribuer_pot   : batch mensuel, priorité accueil puis équilibrage sur
--                          l'écart Vadité ÷ Graines reçues. Demande la formule
--                          d'équilibrage, que la spécification ne fixe pas.
--   - cloture_mensuelle  : cron. Ici le cumul du mois est RECALCULÉ à chaque
--                          frappe depuis les actes, donc rien à réinitialiser :
--                          la clôture ne servira qu'aux paliers historisés.
--   - flecher_contribution : demande le modèle du droit d'usage et de la voix
--                          d'intendance, hors périmètre de ce socle.
-- ─────────────────────────────────────────────────────────────────────────────
