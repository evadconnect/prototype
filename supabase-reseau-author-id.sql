-- ============================================================
--  EVAD — Réseau : identifiant réel de l'auteur d'un post
--  À exécuter dans le SQL Editor du projet Supabase. Idempotent.
--
--  Pourquoi : un post du fil ne mémorisait que le NOM affiché de son auteur
--  (et ce nom valait « Toi » pour tout le monde). Le bouton « Échanger »
--  ouvrait donc une conversation avec un identifiant inventé, que le
--  destinataire ne reconnaissait jamais comme le sien.
--  On stocke désormais l'id stable de la fiche de l'auteur, le même que
--  celui utilisé par la messagerie (messages.author_id / messages.dest_id).
-- ============================================================

alter table public.reseau_posts
  add column if not exists author_id text;

create index if not exists reseau_posts_author_idx on public.reseau_posts (author_id);

-- Les posts déjà publiés restent sans author_id : l'application les rattache
-- à leur fiche par le nom (voir _reseauAuthorId dans js/data-reseau.js).
