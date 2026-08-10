-- ============================================================
--  EVAD — Nettoyage des données de TEST polluant la carte
--  À exécuter dans Supabase PROD (SQL Editor).
--
--  Contexte : pendant la mise au point (vérifications navigateur), des lignes
--  de test « Ferme TEST » ont été poussées dans la base partagée de la bêta.
--  Elles apparaissent comme des doublons sur la carte. Ce script les supprime.
--
--  ⚠️ Ne supprime QUE les lignes de test identifiables sans ambiguïté :
--     - fiche_pilote dont l'id est littéralement 'L1' (user_id NULL) ;
--     - lieu_quetes rattachées aux lieux de test 'L1' et 'L2'
--       (ids 'L1-q1', 'L1-q2', 'L1-q3', 'L2-q1', titre « QUETE AUTRE LIEU »…).
--  Les vrais lieux (avec un user_id de compte réel) ne sont PAS touchés.
-- ============================================================

-- 1) Quêtes de test rattachées aux lieux de test L1 / L2
delete from public.lieu_quetes
where lieu_id in ('L1', 'L2');

-- 2) Lieu de test 'L1' (créé sans compte : user_id NULL)
delete from public.fiche_pilote
where id = 'L1' and user_id is null;

-- ── Vérification : il ne doit plus rester que les vrais lieux ──
-- select id, nom, localisation, user_id from public.fiche_pilote order by created_at;
-- select id, lieu_id, titre from public.lieu_quetes order by lieu_id;
