-- ============================================================
--  EVAD — Bibliothèque : nouvel indicateur écologique « Production locale »
--  À exécuter dans Supabase PROD (SQL Editor). Idempotent (on conflict).
--  Le catalogue ICI est hydraté depuis biblio_indicateurs : sans cette
--  insertion, l'indicateur ajouté au JS serait écrasé en prod.
-- ============================================================

insert into public.biblio_indicateurs
  (id, nom, livre, unite, point0, point100, poids, description, photo, solution_noms, odd, esrs, vsme, ordre, actif)
values (
  'eco_prod_locale',
  'Production locale',
  'ecologie',
  'kg/an',
  0, 3000, 1,
  'Les fruits, légumes et plants produits sur place plutôt qu''importés : une alimentation de proximité qui supprime les kilomètres alimentaires et régénère les sols cultivés.',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80&auto=format&fit=crop',
  '["Jardin permaculture","Potager en buttes","Haie champêtre","AMAP circuit court"]'::jsonb,
  '[2,12]'::jsonb,
  '["E4"]'::jsonb,
  '["B5 · Biodiversité"]'::jsonb,
  7,
  true
)
on conflict (id) do update set
  nom = excluded.nom, livre = excluded.livre, unite = excluded.unite,
  point0 = excluded.point0, point100 = excluded.point100, poids = excluded.poids,
  description = excluded.description, photo = excluded.photo,
  solution_noms = excluded.solution_noms, odd = excluded.odd,
  esrs = excluded.esrs, vsme = excluded.vsme, ordre = excluded.ordre,
  actif = true, updated_at = now();
