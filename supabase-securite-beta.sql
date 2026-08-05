-- ============================================================
--  EVAD — Sécurité de la bêta (beta.evad.org)
--  Objectif : SEULS les comptes connectés (invités) peuvent créer
--  ou modifier des fiches. Les visiteurs anonymes peuvent lire,
--  mais ne peuvent plus rien écrire.
--
--  À exécuter dans Supabase → SQL Editor (projet lmhhrccmgebztioesmik).
--  Se lit de haut en bas. Étapes 0 à 3.
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 0 — (facultatif) Voir les politiques existantes AVANT
-- Lance juste cette requête pour vérifier l'état de départ.
-- ─────────────────────────────────────────────────────────────
-- select tablename, policyname, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;


-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 1 — Tables de contenu : lecture publique, écriture réservée
-- aux comptes connectés.
--
-- On remet ces tables à plat (on supprime toutes leurs politiques
-- existantes, y compris l'ancienne « insertion publique »), puis on
-- recrée exactement 4 règles par table :
--   • SELECT  → tout le monde (le contenu reste visible)
--   • INSERT/UPDATE/DELETE → uniquement le rôle « authenticated »
--
-- ⚠️ Vérifie que la liste de tables ci-dessous correspond à ton projet.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  content_tables text[] := array[
    'lieux', 'batisseurs', 'semeurs',
    'reseau_posts', 'quetes', 'contributions_solution',
    'graines_tx', 'candidatures', 'financements'
  ];
  t text;
  pol record;
begin
  foreach t in array content_tables loop
    -- Ignore une table qui n'existerait pas (adapte la liste si besoin)
    if to_regclass('public.' || t) is null then
      raise notice 'Table absente, ignorée : %', t;
      continue;
    end if;

    -- Active RLS
    execute format('alter table public.%I enable row level security', t);

    -- Supprime toutes les politiques existantes de cette table
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    -- Lecture : publique
    execute format(
      'create policy "%s_sel_public" on public.%I for select using (true)', t, t);

    -- Écriture : réservée aux comptes connectés
    execute format(
      'create policy "%s_ins_auth" on public.%I for insert to authenticated with check (true)', t, t);
    execute format(
      'create policy "%s_upd_auth" on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format(
      'create policy "%s_del_auth" on public.%I for delete to authenticated using (true)', t, t);
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 2 — Fichiers (Storage) : upload réservé aux comptes connectés
-- pour les buckets de contenu ; lecture publique conservée.
--
-- Le bucket « feedback » reste ouvert (on veut des retours même
-- sans compte). Adapte les noms de buckets si nécessaire.
-- ─────────────────────────────────────────────────────────────
-- Lecture publique des fichiers de contenu
drop policy if exists "evad_obj_read" on storage.objects;
create policy "evad_obj_read" on storage.objects
  for select
  using (bucket_id in ('lieux', 'reseau', 'contributions', 'feedback'));

-- Upload réservé aux connectés (lieux, reseau, contributions)
drop policy if exists "evad_obj_upload_auth" on storage.objects;
create policy "evad_obj_upload_auth" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('lieux', 'reseau', 'contributions'));

-- Feedback : upload possible même sans compte (retours ouverts)
drop policy if exists "evad_obj_upload_feedback" on storage.objects;
create policy "evad_obj_upload_feedback" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'feedback');

-- ⚠️ IMPORTANT : si d'anciennes politiques Storage autorisaient déjà
-- l'upload anonyme sur lieux/reseau/contributions, supprime-les.
-- Pour les repérer :
-- select policyname, roles, cmd
-- from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
-- order by policyname;
-- Puis, pour chacune à retirer :
-- drop policy "NOM_DE_LA_POLITIQUE" on storage.objects;


-- ─────────────────────────────────────────────────────────────
-- ÉTAPE 3 — Tables laissées volontairement OUVERTES (ne pas toucher)
-- Ces tables acceptent l'écriture anonyme par choix, ne les verrouille pas :
--   • feedback_prototype   (retours des bêta-testeurs)
--   • motivation_profil    (jeu / profils de motivation)
--   • inscription_beta     (liste d'attente du site internet)
-- Si elles marchent aujourd'hui, laisse-les telles quelles.
-- ─────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- VÉRIFICATION FINALE — relance cette requête pour contrôler.
-- Chaque table de contenu doit avoir 4 politiques (_sel_public,
-- _ins_auth, _upd_auth, _del_auth) et AUCUNE politique d'insert
-- ouverte au rôle « anon » ou « public ».
-- ─────────────────────────────────────────────────────────────
-- select tablename, policyname, roles, cmd
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;
