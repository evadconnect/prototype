-- ============================================================================
--  EVAD — Rattrapage du budget des quêtes déjà publiées
--
--  Le champ « Budget à financer » est arrivé après elles : les quêtes en base
--  n'en ont pas, et le Semeur les voit en « budget non renseigné ».
--  On leur donne le coût matériel de leur solution d'origine, celui-là même
--  que le formulaire propose désormais au Pilote (biblio_solutions.cout_fixe).
--
--  Le budget vit dans la colonne « donnees » (jsonb) : aucune migration de
--  schéma n'est nécessaire, l'app lit les deux emplacements.
--
--  ⚠️ STAGING d'abord. Rejouable : ne touche que les quêtes SANS budget.
-- ============================================================================

-- ── 1. État des lieux : combien de quêtes sans budget, et combien
--       pourront être rattrapées automatiquement ? ──
select
  count(*)                                                          as quetes_publiees,
  count(*) filter (where donnees->>'budget' is null)                as sans_budget,
  count(*) filter (where donnees->>'budget' is null and source is not null) as rattrapables
from public.lieu_quetes
where statut in ('ouverte', 'terminee');

-- ── 2. Aperçu de ce qui serait écrit, AVANT de l'écrire ──
select q.id, q.titre, q.source, round(s.cout_fixe)::int as budget_propose
from public.lieu_quetes q
join public.biblio_solutions s on s.nom = q.source
where q.donnees->>'budget' is null
  and s.cout_fixe is not null
order by q.titre;

-- ── 3. Le rattrapage ──
update public.lieu_quetes q
   set donnees = jsonb_set(coalesce(q.donnees, '{}'::jsonb), '{budget}', to_jsonb(round(s.cout_fixe)::int)),
       updated_at = now()
  from public.biblio_solutions s
 where s.nom = q.source
   and s.cout_fixe is not null
   and (q.donnees->>'budget') is null;

-- ── 4. Contrôle : il ne doit plus rester que les quêtes sur mesure,
--       sans solution d'origine, qu'aucun coût ne permet d'estimer.
--       Celles-là se remplissent à la main dans le formulaire du Pilote. ──
select id, titre, source, donnees->>'budget' as budget
from public.lieu_quetes
where statut in ('ouverte', 'terminee')
order by (donnees->>'budget') is null desc, titre;
