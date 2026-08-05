-- ============================================================
--  EVAD — Sélection des inscrits bêta (table inscription_beta)
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Ajoute un statut pour choisir à qui on ouvre la bêta.
-- ============================================================

-- Statut de chaque inscription : 'nouveau' | 'approuvé' | 'compte_créé'
alter table public.inscription_beta
  add column if not exists statut text not null default 'nouveau';

-- Date de création du compte (renseignée automatiquement par la fonction)
alter table public.inscription_beta
  add column if not exists compte_cree_at timestamptz;

-- ─────────────────────────────────────────────────────────────
-- MODE D'EMPLOI (équipe) :
--   1. Table Editor → inscription_beta.
--   2. Pour chaque personne à qui tu veux ouvrir la bêta, mets
--      la colonne `statut` à  approuvé  (exactement, avec l'accent).
--   3. Va sur la page d'admin et clique « Créer les comptes approuvés ».
--   La fonction crée le compte, envoie l'email, et passe la ligne
--   à  compte_créé  (elle ne la retraitera plus).
-- ─────────────────────────────────────────────────────────────

-- (facultatif) voir l'état des inscriptions :
-- select statut, count(*) from public.inscription_beta group by statut;
