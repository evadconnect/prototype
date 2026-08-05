-- ============================================================
--  EVAD — Multi-profil : profils autorisés par inscription
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.
--
--  3 cases à cocher (colonnes booléennes) dans le Table Editor : on coche
--  les profils auxquels le compte a droit. Simple et visuel.
-- ============================================================

-- Retire l'ancienne colonne tableau (peu pratique dans l'éditeur)
alter table public.inscription_beta drop column if exists profils_autorises;

-- 3 cases à cocher (rendues comme des cases dans le Table Editor)
alter table public.inscription_beta add column if not exists acces_pilote    boolean not null default false;
alter table public.inscription_beta add column if not exists acces_batisseur boolean not null default false;
alter table public.inscription_beta add column if not exists acces_semeur    boolean not null default false;

-- ─────────────────────────────────────────────────────────────
-- MODE D'EMPLOI (équipe), dans Table Editor → inscription_beta :
--   • Ne rien cocher → le compte aura le seul profil choisi à
--     l'inscription (colonne `role`). Rien à faire.
--   • Cocher plusieurs cases (acces_pilote / acces_batisseur /
--     acces_semeur) → le compte aura ces profils.
--
--   La fonction de création lit ces cases et met les profils dans
--   user_metadata.roles. À la connexion : sélecteur + switcher dans l'app.
-- ─────────────────────────────────────────────────────────────
