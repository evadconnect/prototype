-- ─────────────────────────────────────────────────────────────────────────────
-- STAGING (evad-dev) UNIQUEMENT. Ne JAMAIS lancer sur la base de prod.
-- Vérifier que l'URL du projet Supabase contient bien « mpoyfsisbaggvpdpajfo ».
--
-- À lancer après une recopie prod → staging faite avec :
--   drop schema public cascade; create schema public;
--   pg_dump ... --no-privileges | psql ...
--
-- Pourquoi : « drop schema public » supprime aussi les droits par défaut de
-- Supabase, et « --no-privileges » ne recopie pas les GRANT. Les tables
-- arrivent donc sans aucun droit pour les rôles anon / authenticated, d'où les
-- « permission denied for table ... » (401) dans l'app. On restaure ici la
-- configuration par défaut de Supabase. La sécurité reste assurée par les
-- policies RLS, elles, bien recopiées par le dump.
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to postgres, anon, authenticated, service_role;

-- Droits sur ce qui existe déjà (les tables arrivées par le dump).
grant all on all tables    in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;

-- Droits sur ce qui sera créé plus tard (nouvelles tables de l'équipe).
alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;

-- Contrôle : liste les tables encore sans droit de lecture pour anon.
-- Doit renvoyer 0 ligne.
select c.relname as table_sans_droits
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not has_table_privilege('anon', c.oid, 'SELECT')
order by 1;
