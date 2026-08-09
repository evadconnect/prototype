-- ============================================================
--  EVAD — Références ICI adaptées au lieu + coûts structurés des solutions
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Idempotent.
--
--  Principe : on ne touche JAMAIS aux mesures (les litres restent des
--  litres), on adapte la RÉFÉRENCE qui transforme la mesure en sous-score
--  0-100 (le « point100 ») à la taille et au type du lieu :
--    point100 effectif = base_unitaire × dimension du lieu × coef famille
--  - norme = 'm2'     → dimension = surface du lieu (m²)
--  - norme = 'usager' → dimension = capacité d'accueil (personnes)
--  - norme = 'lieu' (ou NULL) → point100 du catalogue, inchangé
--  Familles de type (coef_types) : agriculture | fabrication | social | travail
--
--  Côté solutions : le budget texte (« 80-150 €/m² ») est doublé de champs
--  structurés pour estimer un coût réel par espace :
--    coût estimé = cout_fixe + cout_unitaire × dimension de l'espace
--  - cout_dimension = 'm2' (surface de l'espace) | 'usager' (capacité)
--
--  Toutes ces valeurs sont des DÉFAUTS ÉDITABLES dans le Table Editor :
--  colonnes vides → comportement actuel inchangé (migration douce).
-- ============================================================

-- 1) biblio_indicateurs : normalisation par lieu.
alter table public.biblio_indicateurs add column if not exists norme         text;     -- 'm2' | 'usager' | 'lieu'
alter table public.biblio_indicateurs add column if not exists base_unitaire numeric;  -- valeur « excellent » par unité de dimension
alter table public.biblio_indicateurs add column if not exists coef_types    jsonb;    -- {agriculture, fabrication, social, travail}

-- Défauts pour les ICI les plus sensibles à la taille (calibrés sur les
-- point100 actuels rapportés à un lieu type de 1 000 m² / 100 usagers).
update public.biblio_indicateurs set norme='m2', base_unitaire=0.15,
  coef_types='{"agriculture":1.5,"fabrication":0.5,"social":0.8,"travail":0.5}'
  where id='eco_renat' and norme is null;          -- 100 = 15 % de la surface renaturée

update public.biblio_indicateurs set norme='m2', base_unitaire=8,
  coef_types='{"agriculture":0.8,"fabrication":1.2,"social":1,"travail":1}'
  where id='eco_co2' and norme is null;            -- 100 = 8 kg CO₂e évités /m²/an

update public.biblio_indicateurs set norme='m2', base_unitaire=12,
  coef_types='{"agriculture":0.8,"fabrication":1,"social":1,"travail":1.2}'
  where id='eco_enr' and norme is null;            -- 100 = 12 kWh ENR /m²/an

update public.biblio_indicateurs set norme='usager', base_unitaire=400,
  coef_types='{"agriculture":2,"fabrication":0.7,"social":1,"travail":0.7}'
  where id='eco_eau' and norme is null;            -- 100 = 400 L économisés /usager/an

update public.biblio_indicateurs set norme='usager', base_unitaire=20,
  coef_types='{"agriculture":1,"fabrication":1.5,"social":1,"travail":0.7}'
  where id='eco_dechets' and norme is null;        -- 100 = 20 kg détournés /usager/an

update public.biblio_indicateurs set norme='m2', base_unitaire=3,
  coef_types='{"agriculture":2,"fabrication":0.4,"social":0.8,"travail":0.4}'
  where id='eco_prod_locale' and norme is null;    -- 100 = 3 kg produits /m²/an

update public.biblio_indicateurs set norme='usager', base_unitaire=4,
  coef_types='{"agriculture":0.8,"fabrication":1.2,"social":1,"travail":1.2}'
  where id='soc_formation' and norme is null;      -- 100 = 4 h de formation /usager de capacité/an

update public.biblio_indicateurs set norme='usager', base_unitaire=3,
  coef_types='{"agriculture":1,"fabrication":1,"social":1.2,"travail":0.8}'
  where id='soc_sensibilisation' and norme is null; -- 100 = 3 personnes sensibilisées /usager/an

update public.biblio_indicateurs set norme='usager', base_unitaire=0.4,
  coef_types='{"agriculture":1,"fabrication":1,"social":1.2,"travail":0.6}'
  where id='soc_benevoles' and norme is null;      -- 100 = 0,4 bénévole /usager de capacité

update public.biblio_indicateurs set norme='usager', base_unitaire=0.05,
  coef_types='{"agriculture":1,"fabrication":1,"social":1,"travail":1.5}'
  where id='eco_emplois' and norme is null;        -- 100 = 5 ETP pour 100 usagers

-- (soc_insertion, soc_evenements, eco_approv, eco_biosource, eco_partenaires,
--  eco_fraicheur : norme 'lieu' implicite → barème catalogue inchangé.)

-- 2) biblio_solutions : coûts structurés.
alter table public.biblio_solutions add column if not exists cout_fixe      numeric;  -- € (études, base, raccordement)
alter table public.biblio_solutions add column if not exists cout_unitaire  numeric;  -- € par unité de dimension
alter table public.biblio_solutions add column if not exists cout_dimension text;     -- 'm2' | 'usager'

-- Défauts pour les solutions au coût clairement proportionnel (fourchettes
-- du catalogue converties en fixe + unitaire, à affiner dans le Table Editor).
update public.biblio_solutions set cout_fixe=1500, cout_unitaire=120, cout_dimension='m2'
  where nom='Toiture végétalisée' and cout_unitaire is null;
update public.biblio_solutions set cout_fixe=1000, cout_unitaire=110, cout_dimension='m2'
  where nom='Isolation paille' and cout_unitaire is null;
update public.biblio_solutions set cout_fixe=500, cout_unitaire=80, cout_dimension='m2'
  where nom='Désimperméabilisation des sols' and cout_unitaire is null;
update public.biblio_solutions set cout_fixe=300, cout_unitaire=15, cout_dimension='m2'
  where nom='Jardin permaculture' and cout_unitaire is null;
update public.biblio_solutions set cout_fixe=100, cout_unitaire=10, cout_dimension='m2'
  where nom='Potager en buttes' and cout_unitaire is null;
update public.biblio_solutions set cout_fixe=1200, cout_unitaire=8, cout_dimension='m2'
  where nom='Récupération eau de pluie' and cout_unitaire is null;
update public.biblio_solutions set cout_fixe=3000, cout_unitaire=100, cout_dimension='usager'
  where nom='Phytoépuration' and cout_unitaire is null;
update public.biblio_solutions set cout_fixe=800, cout_unitaire=40, cout_dimension='usager'
  where nom='Toilettes sèches' and cout_unitaire is null;

-- ============================================================
--  Après ça : la fiche d'une solution affiche un coût estimé pour
--  l'espace du lieu (surface × €/m²), et les cibles des indicateurs
--  s'adaptent à la taille et au type du lieu. Tout reste ajustable
--  colonne par colonne dans le Table Editor.
-- ============================================================
