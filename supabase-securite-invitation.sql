-- ============================================================================
--  EVAD — Accès entièrement sur invitation
--  Remplace supabase-securite-beta.sql (écrit en août, jamais lancé, et dont la
--  liste de tables est périmée : il parle de « lieux », « batisseurs »,
--  « quetes », renommées depuis en « fiche_pilote », « fiche_batisseur »,
--  « lieu_quetes »).
--
--  CONSTAT du 2026-08-17 : sans aucun compte, l'API REST laissait lire
--  fiche_pilote, fiche_batisseur, reseau_posts, lieu_quetes, lieu_indicateurs,
--  lieu_solutions, quete_candidatures, quete_preuves et graines_tx, et laissait
--  aussi modifier et supprimer. Le formulaire de connexion ne protège que
--  l'interface : la base se joint directement, la RLS est le seul vrai verrou.
--
--  OBJECTIF : plus rien n'est accessible sans compte. Les comptes invités
--  voient le contenu partagé de la bêta et ne peuvent modifier que le leur.
--
--  ⚠️ ORDRE : lancer d'abord sur STAGING (evad-dev, mpoyfsisbaggvpdpajfo),
--  vérifier que l'app fonctionne toujours, et seulement ensuite sur la PROD
--  (lmhhrccmgebztioesmik). Le script est rejouable sans dommage.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 0 — État des lieux AVANT (lecture seule, ne modifie rien)
-- Gardez le résultat sous la main pour comparer avec l'étape 3.
-- ─────────────────────────────────────────────────────────────────────────────
select c.relname as table_, c.relrowsecurity as rls_active, count(p.polname) as nb_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by 1, 2
order by rls_active, 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 1 — Le modèle d'accès
--
--  CONTENU     lecture pour tout compte connecté, écriture réservée au
--              propriétaire de la ligne (colonne user_id). Création ouverte à
--              tout compte connecté. Une table de contenu sans user_id, comme
--              reseau_posts, reste modifiable par tout compte connecté.
--  REFERENCE   catalogues de la Bibliothèque : lecture pour les comptes
--              connectés, aucune écriture depuis l'app.
--  PRIVE       le propriétaire est seul à lire et à écrire.
--  COURRIER    formulaires qui écrivent sans session (ils utilisent la clé
--              anon, pas le jeton du compte) : insertion conservée pour anon,
--              mais lecture interdite à tout le monde.
--  messages    volontairement ABSENTE de ces listes : ses policies existantes
--              distinguent déjà expéditeur et destinataire, elles sont plus
--              fines que le modèle générique. Y toucher ouvrirait toutes les
--              conversations à tous les comptes.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  contenu   text[] := array[
    'fiche_pilote', 'fiche_batisseur', 'fiche_semeur',
    'reseau_posts', 'lieu_quetes', 'lieu_indicateurs', 'lieu_solutions',
    'quete_candidatures', 'quete_preuves',
    'graines_tx', 'mkt_transactions', 'offres_mkt'
  ];
  reference text[] := array['biblio_solutions', 'biblio_indicateurs', 'biblio_espaces_eco'];
  prive     text[] := array['fiches_brouillons'];
  courrier  text[] := array['feedback_prototype', 'contributions_solution', 'inscription_beta'];
  t         text;
  pol       record;
  col_prop  text;
begin
  -- ── Table par table ──
  foreach t in array (contenu || reference || prive || courrier) loop
    if to_regclass('public.' || t) is null then
      raise notice 'Table absente, ignorée : %', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);

    -- Table nettoyée de ses anciennes règles avant d'appliquer le modèle.
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    -- Colonne qui désigne le propriétaire de la ligne, si elle existe.
    -- Seule « user_id » fait foi : c'est la seule à contenir l'identifiant du
    -- compte Supabase. Surtout PAS « author_id » de reseau_posts, qui porte
    -- l'identifiant de la FICHE (lieu, bâtisseur, semeur), voire un identifiant
    -- local anonyme, voir evadChatMe dans js/messages.js. S'en servir comme
    -- propriétaire bloquerait toute modification sans rien sécuriser.
    select column_name into col_prop
    from information_schema.columns
    where table_schema = 'public' and table_name = t and column_name = 'user_id'
    limit 1;

    if t = any(courrier) then
      -- Dépôt sans lecture : on peut écrire, jamais relire.
      execute format('create policy "depot anonyme" on public.%I for insert to anon, authenticated with check (true)', t);
      -- Pas de policy SELECT : la lecture reste possible depuis le tableau de
      -- bord Supabase (service_role), jamais depuis le site.

    elsif t = any(reference) then
      execute format('create policy "lecture invites" on public.%I for select to authenticated using (true)', t);

    elsif t = any(prive) then
      if col_prop is null then
        raise exception 'Table privée % sans colonne de propriétaire : à traiter à la main', t;
      end if;
      -- Comparaison en texte des deux côtés : selon les tables, user_id est
      -- typé uuid ou text, et « text = uuid » n'existe pas en Postgres.
      execute format('create policy "proprietaire seul" on public.%I for all to authenticated using (%I::text = auth.uid()::text) with check (%I::text = auth.uid()::text)', t, col_prop, col_prop);

    else  -- contenu
      execute format('create policy "lecture invites" on public.%I for select to authenticated using (true)', t);
      execute format('create policy "creation invites" on public.%I for insert to authenticated with check (true)', t);
      if col_prop is null then
        -- Pas de colonne user_id : cas de reseau_posts, dont l'auteur est
        -- désigné par une fiche et non par un compte. Tout compte connecté peut
        -- donc modifier. À resserrer le jour où la table portera un user_id.
        execute format('create policy "modification invites" on public.%I for update to authenticated using (true) with check (true)', t);
        execute format('create policy "suppression invites" on public.%I for delete to authenticated using (true)', t);
        raise notice 'Table % sans colonne user_id : ecriture ouverte a tous les comptes connectes', t;
      else
        execute format('create policy "modification proprietaire" on public.%I for update to authenticated using (%I::text = auth.uid()::text) with check (%I::text = auth.uid()::text)', t, col_prop, col_prop);
        execute format('create policy "suppression proprietaire" on public.%I for delete to authenticated using (%I::text = auth.uid()::text)', t, col_prop);
      end if;
    end if;

    -- Ceinture et bretelles : le rôle anon perd tout droit SQL sur ces tables,
    -- sauf l'insertion sur les formulaires de dépôt.
    execute format('revoke all on public.%I from anon', t);
    if t = any(courrier) then
      execute format('grant insert on public.%I to anon', t);
    end if;
  end loop;

  -- ── Tables du schéma public absentes des listes ci-dessus ──
  -- Signalées pour que rien ne passe entre les mailles sans décision explicite.
  for pol in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname <> all(contenu || reference || prive || courrier)
      and c.relname <> 'messages'
  loop
    raise notice 'NON TRAITEE, a decider : %', pol.relname;
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 — Storage : mêmes règles pour les fichiers
-- Les buckets avaient une policy « for all » ouverte à anon, héritée de l'époque
-- où l'on téléversait sans compte.
--
-- ⚠️ Deux buckets gardent l'insertion anonyme : « contributions » et
-- « feedback ». Les formulaires « Proposer une solution » et « Proposer une
-- amélioration » téléversent leurs images avec la clé anon et non avec le jeton
-- de session (voir js/contribution.js et js/fil-rouge-feedback.js). Leur retirer
-- ce droit casserait les deux formulaires. Ils ne peuvent qu'écrire, pas relire.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  b text;
  pol record;
  depot text[] := array['contributions', 'feedback'];
begin
  for b in select unnest(array['lieux', 'preuves', 'contributions', 'feedback']) loop
    for pol in
      select policyname from pg_policies
      where schemaname = 'storage' and tablename = 'objects' and policyname like '%' || b || '%'
    loop
      execute format('drop policy if exists %I on storage.objects', pol.policyname);
    end loop;

    execute format(
      'create policy "acces invites %s" on storage.objects for all to authenticated using (bucket_id = %L) with check (bucket_id = %L)',
      b, b, b);

    if b = any(depot) then
      execute format(
        'create policy "depot anonyme %s" on storage.objects for insert to anon with check (bucket_id = %L)',
        b, b);
    end if;
  end loop;
end $$;

-- ⚠️ LIMITE CONNUE, à traiter séparément : un bucket marqué « Public » dans
-- Supabase sert ses fichiers par URL sans vérifier la moindre policy. L'app
-- affiche justement les images via des URL /object/public/... Tant que les
-- buckets restent publics, une personne qui connaît l'URL exacte d'une image
-- peut l'ouvrir sans compte. Les policies ci-dessus verrouillent le dépôt et le
-- listage, pas cette lecture directe. Pour fermer complètement, il faut passer
-- les buckets en privé ET remplacer getPublicUrl par createSignedUrl dans le
-- code. C'est un chantier à part, à décider après ce script.


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 2 bis — messages
--
-- Vérifié le 2026-08-17 : contrairement à ce que je pensais en écrivant
-- l'étape 1, cette table n'est PAS protégée. supabase-messages.sql lui donne
-- « select using (true) » et « insert with check (true) », en annonçant
-- lui-même que « le verrouillage par participant viendra avec le lot de
-- sécurité ». Elle renvoyait zéro ligne à ma sonde simplement parce que la
-- table du staging est vide. En production, toutes les conversations privées
-- sont donc lisibles sans compte, et n'importe qui peut y écrire sous
-- l'identité d'un autre.
--
-- LIMITE ASSUMÉE : la table ne contient aucun lien vers le compte Supabase.
-- author_id et dest_id portent des identifiants de FICHE, thread_id une clé
-- construite côté navigateur. On ne peut donc pas exprimer « je suis
-- participant de ce fil » en RLS aujourd'hui. On réserve l'accès aux comptes
-- connectés, ce qui ferme l'accès public. Le cloisonnement par participant
-- demande d'ajouter une colonne user_id alimentée à l'envoi, côté code.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare pol record;
begin
  if to_regclass('public.messages') is null then
    raise notice 'Table messages absente';
    return;
  end if;
  alter table public.messages enable row level security;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'messages' loop
    execute format('drop policy if exists %I on public.messages', pol.policyname);
  end loop;
  create policy "lecture invites"   on public.messages for select to authenticated using (true);
  create policy "envoi invites"     on public.messages for insert to authenticated with check (true);
  -- Ni update ni delete : un message envoyé ne se modifie pas depuis l'app.
  revoke all on public.messages from anon;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- ÉTAPE 3 — Vérification APRÈS
-- Chaque table doit avoir rls_active = true et au moins une policy.
-- ─────────────────────────────────────────────────────────────────────────────
select c.relname as table_, c.relrowsecurity as rls_active, count(p.polname) as nb_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by 1, 2
order by rls_active, 1;

-- Détail des règles, pour relecture. Aucune ligne ne doit mentionner le rôle
-- « anon » en dehors des trois formulaires de dépôt.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
