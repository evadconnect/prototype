-- ============================================================
--  EVAD — Durées des quêtes en journées / demi-journées
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent.
--  Simplifie quete_duree : plus de week-end, semaine, heure, séance,
--  réunion, atelier ni soirée — seulement des journées / demi-journées.
--  Le catalogue étant hydraté depuis biblio_solutions, cette mise à jour
--  est nécessaire pour que la simplification apparaisse en prod.
-- ============================================================

update public.biblio_solutions set quete_duree = '3 journées',     updated_at = now() where quete_titre = 'Créer une zone de phytoépuration';
update public.biblio_solutions set quete_duree = '2 journées',     updated_at = now() where quete_titre = 'Chantier participatif d''installation solaire';
update public.biblio_solutions set quete_duree = '4 journées',     updated_at = now() where quete_titre = 'Chantier d''isolation paille participatif';
update public.biblio_solutions set quete_duree = '3 demi-journées', updated_at = now() where quete_titre = 'Créer un jardin en permaculture';
update public.biblio_solutions set quete_duree = '1 demi-journée',  updated_at = now() where quete_titre = 'Lancer le compostage collectif';
update public.biblio_solutions set quete_duree = '1 demi-journée',  updated_at = now() where quete_titre = 'Organiser le premier Repair Café';
update public.biblio_solutions set quete_duree = '2 demi-journées', updated_at = now() where quete_titre = 'Monter le partenariat AMAP';
update public.biblio_solutions set quete_duree = '3 journées',     updated_at = now() where quete_titre = 'Installer une toiture végétalisée';
update public.biblio_solutions set quete_duree = '2 journées',     updated_at = now() where quete_titre = 'Audit & rafraîchissement passif';
update public.biblio_solutions set quete_duree = '3 journées',     updated_at = now() where quete_titre = 'Désimperméabiliser une cour';
update public.biblio_solutions set quete_duree = '1 demi-journée',  updated_at = now() where quete_titre = 'Animer un atelier de transmission';
update public.biblio_solutions set quete_duree = '2 demi-journées', updated_at = now() where quete_titre = 'Référencer les producteurs locaux';
update public.biblio_solutions set quete_duree = '4 journées',     updated_at = now() where quete_titre = 'Lancer un point de réemploi';

-- Contrôle : liste les durées qui contiendraient encore une unité à bannir.
-- Doit renvoyer 0 ligne après exécution. (Les mots « journée/demi-journée »
-- sont volontairement exclus via les frontières de mot \y.)
-- select id, quete_titre, quete_duree from public.biblio_solutions
--  where quete_duree ~* '(week-?end|semaine|heure|séance|réunion|atelier|soirée|après-midi|\yjours?\y)';
