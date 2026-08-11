-- ============================================================
--  EVAD — Coût d'investissement structuré de CHAQUE solution
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent.
--
--  Coût estimé d'une solution pour un espace :
--    coût = cout_fixe + cout_unitaire × dimension de l'espace
--    cout_dimension = 'm2'     → dimension = surface de l'espace (m²)
--    cout_dimension = 'usager' → dimension = capacité de l'espace (personnes)
--
--  Ces colonnes sont lues par l'app (hydrateBiblio → SOLS.coutFixe/coutUnitaire/
--  coutDimension) et nourrissent le « Potentiel économique » (point mort).
--  Ordres de grandeur PRUDENTS, éditables dans le Table Editor.
-- ============================================================

alter table public.biblio_solutions add column if not exists cout_fixe      numeric;
alter table public.biblio_solutions add column if not exists cout_unitaire  numeric;
alter table public.biblio_solutions add column if not exists cout_dimension text;

-- ── Solutions dimensionnées à la SURFACE (€/m²) ──
update public.biblio_solutions set cout_fixe = 1500, cout_unitaire = 120, cout_dimension = 'm2'     where nom = 'Toiture végétalisée';
update public.biblio_solutions set cout_fixe = 1200, cout_unitaire = 90,  cout_dimension = 'm2'     where nom = 'Toiture & murs végétalisés';
update public.biblio_solutions set cout_fixe = 1000, cout_unitaire = 110, cout_dimension = 'm2'     where nom = 'Isolation paille';
update public.biblio_solutions set cout_fixe = 1200, cout_unitaire = 45,  cout_dimension = 'm2'     where nom = 'Rafraîchissement passif du bâti';
update public.biblio_solutions set cout_fixe = 500,  cout_unitaire = 80,  cout_dimension = 'm2'     where nom = 'Désimperméabilisation des sols';
update public.biblio_solutions set cout_fixe = 1000, cout_unitaire = 40,  cout_dimension = 'm2'     where nom = 'Canopée & îlots de fraîcheur';
update public.biblio_solutions set cout_fixe = 800,  cout_unitaire = 90,  cout_dimension = 'm2'     where nom = 'Ombrières & pergolas bioclimatiques';
update public.biblio_solutions set cout_fixe = 300,  cout_unitaire = 15,  cout_dimension = 'm2'     where nom = 'Jardin permaculture';
update public.biblio_solutions set cout_fixe = 100,  cout_unitaire = 10,  cout_dimension = 'm2'     where nom = 'Potager en buttes';
update public.biblio_solutions set cout_fixe = 200,  cout_unitaire = 6,   cout_dimension = 'm2'     where nom = 'Haie champêtre';
update public.biblio_solutions set cout_fixe = 1500, cout_unitaire = 25,  cout_dimension = 'm2'     where nom = 'Mare écologique';
update public.biblio_solutions set cout_fixe = 1200, cout_unitaire = 8,   cout_dimension = 'm2'     where nom = 'Récupération eau de pluie';
update public.biblio_solutions set cout_fixe = 4000, cout_unitaire = 60,  cout_dimension = 'm2'     where nom = 'Panneaux solaires PV';
update public.biblio_solutions set cout_fixe = 2000, cout_unitaire = 15,  cout_dimension = 'm2'     where nom = 'Recyclerie & réemploi local';
update public.biblio_solutions set cout_fixe = 500,  cout_unitaire = 5,   cout_dimension = 'm2'     where nom = 'Réemploi matériaux';

-- ── Solutions dimensionnées à la CAPACITÉ (€/usager) ──
update public.biblio_solutions set cout_fixe = 3000, cout_unitaire = 100, cout_dimension = 'usager' where nom = 'Phytoépuration';
update public.biblio_solutions set cout_fixe = 800,  cout_unitaire = 40,  cout_dimension = 'usager' where nom = 'Toilettes sèches';
update public.biblio_solutions set cout_fixe = 3000, cout_unitaire = 120, cout_dimension = 'usager' where nom = 'Chauffe-eau solaire';
update public.biblio_solutions set cout_fixe = 400,  cout_unitaire = 8,   cout_dimension = 'usager' where nom = 'Compostage partagé';
update public.biblio_solutions set cout_fixe = 1500, cout_unitaire = 20,  cout_dimension = 'usager' where nom = 'Repair café';
update public.biblio_solutions set cout_fixe = 600,  cout_unitaire = 10,  cout_dimension = 'usager' where nom = 'Atelier de transmission';
update public.biblio_solutions set cout_fixe = 400,  cout_unitaire = 8,   cout_dimension = 'usager' where nom = 'Chantier participatif';
update public.biblio_solutions set cout_fixe = 800,  cout_unitaire = 3,   cout_dimension = 'usager' where nom = 'AMAP circuit court';
update public.biblio_solutions set cout_fixe = 300,  cout_unitaire = 2,   cout_dimension = 'usager' where nom = 'Approvisionnement local';

notify pgrst, 'reload schema';

-- ── Vérification : toutes les solutions doivent avoir un coût ──
-- select nom, cout_fixe, cout_unitaire, cout_dimension from public.biblio_solutions
--   order by cout_dimension, nom;
-- select nom from public.biblio_solutions where cout_unitaire is null;  -- doit être vide
