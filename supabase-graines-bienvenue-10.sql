-- ============================================================================
--  Graines de bienvenue : 10 pour Bâtisseur & Pilote, AUCUNE pour le Semeur
-- ----------------------------------------------------------------------------
--  - Bâtisseur & Pilote : le don de bienvenue passe à 10 graines (ex-100, 20…).
--  - Semeur : plus de graines du tout — on retire leurs écritures de bienvenue
--    historiques du grand livre.
--
--  Ce script aligne les écritures HISTORIQUES (table graines_tx) sur ces règles.
--  À exécuter dans le SQL Editor de Supabase, sur chaque base concernée
--  (prod ET staging). Idempotent : relançable sans risque.
-- ============================================================================

-- 1) Aperçu de ce qui sera modifié (facultatif — lance-le d'abord pour vérifier).
select party_type, count(*) as nb_entrees, sum(delta) as total_bienvenue_avant
from public.graines_tx
where type = 'welcome'
group by party_type
order by party_type;

-- 2a) Bâtisseur & Pilote : ramener chaque don de bienvenue à 10.
update public.graines_tx
set delta = 10
where type = 'welcome'
  and party_type in ('batisseur', 'pilote')
  and delta <> 10;

-- 2b) Semeur : supprimer les graines de bienvenue (plus de graines pour eux).
delete from public.graines_tx
where type = 'welcome'
  and party_type = 'semeur';

-- 3) Vérification : bâtisseur/pilote → 10, aucune ligne de bienvenue semeur.
select party_type, delta, count(*) as nb
from public.graines_tx
where type = 'welcome'
group by party_type, delta
order by party_type, delta;
