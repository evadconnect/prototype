-- Corrige le titre de la quête « Toilettes sèches » (retrait de « et documenter »).
update public.biblio_solutions
   set quete_titre = 'Installer les toilettes sèches', updated_at = now()
 where id = 'toilettes-seches';
