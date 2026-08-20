-- ============================================================================
--  Graines de bienvenue → 10 (Bâtisseur & Pilote)
-- ----------------------------------------------------------------------------
--  Le don de bienvenue passe de son ancien montant (100, puis 20) à 10 graines
--  pour les profils Bâtisseur et Pilote. Ce script aligne les écritures
--  HISTORIQUES du grand livre (graines_tx) sur ce nouveau montant.
--
--  IMPORTANT : on ne touche PAS au Semeur, dont l'entrée « welcome » (500) est
--  un budget de financement, pas un don de bienvenue au sens Bâtisseur/Pilote.
--
--  À exécuter dans le SQL Editor de Supabase (base concernée : prod OU staging).
--  Idempotent : relançable sans risque (met simplement delta à 10).
-- ============================================================================

-- 1) Aperçu de ce qui sera modifié (facultatif — lance-le d'abord pour vérifier).
select party_type, count(*) as nb_entrees, sum(delta) as total_avant
from public.graines_tx
where type = 'welcome'
  and party_type in ('batisseur', 'pilote')
  and delta <> 10
group by party_type;

-- 2) Migration : ramener chaque don de bienvenue Bâtisseur/Pilote à 10.
update public.graines_tx
set delta = 10
where type = 'welcome'
  and party_type in ('batisseur', 'pilote')
  and delta <> 10;

-- 3) Vérification : après migration, tous les dons Bâtisseur/Pilote valent 10,
--    le Semeur reste à 500.
select party_type, delta, count(*) as nb
from public.graines_tx
where type = 'welcome'
group by party_type, delta
order by party_type, delta;
