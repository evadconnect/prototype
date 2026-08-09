-- ============================================================
--  EVAD — Barème du potentiel économique des espaces
--  À exécuter dans le projet Supabase de PROD (lmhhrccmgebztioesmik)
--  → SQL Editor. Idempotent.
--
--  Affiché dans la fiche lieu (onglet Espaces), la fiche du tableau de
--  bord et le wizard :
--    revenus/mois ≈ dimension × facteur × prix (fourchette) × coef type
--    marge = revenus × (1 − charges) ; point mort = coût solutions ÷ marge
--  - dim = 'capacite' (personnes/postes/lits) | 'surface' (m²) | 'forfait'
--  - facteur = unités servies par mois et par unité de dimension,
--    OCCUPATION RÉALISTE DÉJÀ INCLUSE (ex. café : 0,6 rotation × 21 jours)
--  Ces valeurs sont des ordres de grandeur PRUDENTS, éditables ici ;
--  le code embarque les mêmes défauts (repli si table absente/vide).
-- ============================================================

create table if not exists public.biblio_espaces_eco (
  id          text primary key,              -- eid de l'espace (cafe, bureau, jardin…)
  dim         text not null default 'capacite',  -- capacite | surface | forfait
  facteur     numeric not null default 1,    -- unités/mois par unité de dimension
  unite       text,                          -- libellé (couverts/mois, postes…)
  prix_min    numeric,
  prix_max    numeric,
  prix_unite  text,                          -- €/couvert, €/poste/mois…
  charges_pct numeric not null default 0.4,  -- part des revenus absorbée par les charges
  actif       boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.biblio_espaces_eco enable row level security;

drop policy if exists "espaces_eco_select_public" on public.biblio_espaces_eco;
create policy "espaces_eco_select_public" on public.biblio_espaces_eco for select using (true);

-- Défauts (miroir du code) : ajuste librement dans le Table Editor.
insert into public.biblio_espaces_eco (id, dim, facteur, unite, prix_min, prix_max, prix_unite, charges_pct) values
  ('cafe',     'capacite', 12.6,   'couverts/mois',        8,   15,  '€/couvert',       0.55),
  ('cuisine',  'capacite', 8.4,    'repas/mois',           7,   12,  '€/repas',         0.55),
  ('bureau',   'capacite', 1,      'postes',               150, 250, '€/poste/mois',    0.30),
  ('dortoir',  'capacite', 13.5,   'nuitées/mois',         25,  60,  '€/nuitée',        0.45),
  ('salle',    'forfait',  8,      'locations/mois',       150, 400, '€/jour loué',     0.30),
  ('fablab',   'capacite', 1,      'adhérents',            15,  30,  '€/adhésion/mois', 0.35),
  ('atelier',  'capacite', 1.5,    'participations/mois',  25,  60,  '€/participant',   0.35),
  ('serre',    'surface',  0.0833, 'm² cultivés',          4,   9,   '€/m²/an',         0.40),
  ('jardin',   'surface',  0.0833, 'm² cultivés',          3,   8,   '€/m²/an',         0.40),
  ('boutique', 'surface',  1,      'm² de vente',          8,   25,  '€/m²/mois',       0.50)
on conflict (id) do nothing;

-- ============================================================
--  Après ça : chaque espace de la fiche lieu affiche « 💶 Potentiel
--  économique » (revenus, marge, amortissement des solutions), calculé
--  depuis sa capacité/surface. Modifier une ligne ici ajuste l'app.
-- ============================================================
