-- ============================================================
--  EVAD — Multi-profil : profils autorisés par inscription
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.
--
--  Colonne `profils_autorises` en MULTI-CHOIX (tableau d'un type énuméré) :
--  dans le Table Editor, on coche pilote / batisseur / semeur.
-- ============================================================

-- 1. Type des profils (valeurs proposées dans le multi-choix)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_profil') then
    create type role_profil as enum ('pilote', 'batisseur', 'semeur');
  end if;
end $$;

-- 2. Remplace l'ancienne colonne texte `roles` par `profils_autorises`
alter table public.inscription_beta drop column if exists roles;
alter table public.inscription_beta
  add column if not exists profils_autorises role_profil[];

-- ─────────────────────────────────────────────────────────────
-- MODE D'EMPLOI (équipe), dans Table Editor → inscription_beta :
--   • Colonne `profils_autorises` VIDE → le compte aura le seul profil
--     choisi à l'inscription (colonne `role`). Rien à faire.
--   • Pour plusieurs profils : clique la cellule et COCHE les profils
--     voulus (pilote / batisseur / semeur) dans le menu multi-choix.
--
--   La fonction de création lit `profils_autorises` et les met dans
--   user_metadata.roles. À la connexion : sélecteur + switcher dans l'app.
-- ─────────────────────────────────────────────────────────────
