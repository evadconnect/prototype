-- ============================================================
--  EVAD — Multi-profil : profils autorisés par inscription
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor.
--
--  Ajoute une colonne `roles` à inscription_beta pour donner
--  PLUSIEURS profils à un même compte.
-- ============================================================

alter table public.inscription_beta
  add column if not exists roles text;

-- ─────────────────────────────────────────────────────────────
-- MODE D'EMPLOI (équipe) :
--   • Laisser `roles` VIDE  → le compte aura le seul profil choisi
--     à l'inscription (colonne `role`). Rien à faire.
--   • Pour donner plusieurs profils, écrire dans `roles` la liste
--     séparée par des virgules, par ex. :  pilote,batisseur
--     (valeurs possibles : pilote, batisseur, semeur)
--
--   La fonction de création de comptes lit cette colonne et met les
--   profils dans user_metadata.roles. À la connexion, l'utilisateur
--   voit un sélecteur et peut basculer entre ses profils dans l'app.
-- ─────────────────────────────────────────────────────────────
