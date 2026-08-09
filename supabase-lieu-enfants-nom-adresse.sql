-- ============================================================
--  EVAD — lieu_solutions / lieu_indicateurs : nom du lieu + adresse
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent.
--  Ajoute deux colonnes de confort (lieu_nom, adresse) recopiées
--  depuis la fiche du lieu à chaque publication, pour lire ces
--  tables sans jointure sur fiche_pilotes.
-- ============================================================

alter table public.lieu_solutions   add column if not exists lieu_nom text;
alter table public.lieu_solutions   add column if not exists adresse  text;

alter table public.lieu_indicateurs add column if not exists lieu_nom text;
alter table public.lieu_indicateurs add column if not exists adresse  text;

-- Remplissage rétroactif des lignes déjà présentes, à partir de fiche_pilotes.
update public.lieu_solutions s
   set lieu_nom = coalesce(s.lieu_nom, f.nom),
       adresse  = coalesce(s.adresse,  f.localisation)
  from public.fiche_pilotes f
 where f.id = s.lieu_id
   and (s.lieu_nom is null or s.adresse is null);

update public.lieu_indicateurs i
   set lieu_nom = coalesce(i.lieu_nom, f.nom),
       adresse  = coalesce(i.adresse,  f.localisation)
  from public.fiche_pilotes f
 where f.id = i.lieu_id
   and (i.lieu_nom is null or i.adresse is null);
