-- ============================================================================
--  EVAD — Cloisonnement de la messagerie par participant
--
--  Suite de supabase-securite-invitation.sql. Après ce dernier, les
--  conversations ne sont plus publiques, mais tout compte invité peut encore
--  lire les fils des autres : la table `messages` ne porte aucun lien vers le
--  compte Supabase. author_id et dest_id contiennent des identifiants de FICHE
--  (voir evadChatMe dans js/messages.js), thread_id une clé fabriquée par le
--  navigateur. La RLS n'a donc rien à quoi se raccrocher.
--
--  On ajoute ce lien : user_id (expéditeur) et dest_user_id (destinataire).
--
--  ⚠️ DEUX TEMPS, volontairement séparés. La PHASE 1 ne change aucun
--  comportement : elle ajoute les colonnes et remplit l'existant. On vérifie
--  alors le taux de remplissage. La PHASE 2 ne se lance QUE si ce taux est bon,
--  sinon elle rendrait invisibles les conversations dont le destinataire n'a
--  pas pu être résolu.
--
--  Ordre : staging (evad-dev) d'abord, production ensuite.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1 — Colonnes et reprise de l'existant (sans effet sur les accès)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.messages add column if not exists user_id      uuid;
alter table public.messages add column if not exists dest_user_id uuid;

create index if not exists messages_user_idx      on public.messages (user_id);
create index if not exists messages_dest_user_idx on public.messages (dest_user_id);

-- Correspondance identifiant de fiche → compte propriétaire.
-- Les id de fiche sont des uuid, author_id et dest_id du texte : on compare en
-- texte. Les anciens identifiants par nom (« nom:Camille », « bat:… ») ne
-- correspondront à rien, c'est attendu : ces lignes resteront sans compte.
create or replace view public._fiche_comptes as
  select id::text as fiche_id, user_id from public.fiche_pilote    where user_id is not null
  union all
  select id::text, user_id from public.fiche_batisseur where user_id is not null
  union all
  select id::text, user_id from public.fiche_semeur    where user_id is not null;

update public.messages m
   set user_id = f.user_id
  from public._fiche_comptes f
 where m.user_id is null and m.author_id = f.fiche_id;

update public.messages m
   set dest_user_id = f.user_id
  from public._fiche_comptes f
 where m.dest_user_id is null and m.dest_id = f.fiche_id;

drop view public._fiche_comptes;


-- ─────────────────────────────────────────────────────────────────────────────
-- CONTRÔLE — à lire avant d'envisager la phase 2
--
-- « sans_destinataire » est le chiffre qui décide : ce sont les messages que
-- leur destinataire ne pourrait plus lire après la phase 2. Tant qu'il n'est
-- pas proche de zéro sur les conversations récentes, on ne resserre pas.
-- ─────────────────────────────────────────────────────────────────────────────
select count(*)                                             as total,
       count(user_id)                                       as avec_expediteur,
       count(dest_user_id)                                  as avec_destinataire,
       count(*) filter (where dest_user_id is null)         as sans_destinataire,
       count(*) filter (where created_at > now() - interval '30 days'
                          and dest_user_id is null)         as sans_destinataire_30j
from public.messages;


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 1 bis — Droit de supprimer ses conversations
--
-- Constaté le 2026-08-17 : la corbeille de la boîte de réception et le bouton
-- « Supprimer toutes mes conversations » n'avaient jamais d'effet durable. La
-- table n'a aucune policy DELETE, donc la RLS ne supprime rien, sans lever
-- d'erreur, et la synchronisation suivante rapatriait les lignes restées en
-- base. Effacer le cache local ne suffit jamais.
--
-- À lancer dès maintenant, indépendamment de la phase 2.
-- Les lignes antérieures à la phase 1, sans user_id ni dest_user_id, restent
-- non supprimables : c'est volontaire, on ne donne pas un droit de suppression
-- sur des messages dont on ne sait pas à qui ils appartiennent.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "suppression de mes conversations" on public.messages;
create policy "suppression de mes conversations" on public.messages
  for delete to authenticated
  using (user_id = auth.uid() or dest_user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- PHASE 2 — Le verrou par participant
--
-- ⚠️ NE PAS LANCER tant que le contrôle ci-dessus n'est pas satisfaisant, et
-- pas avant que la nouvelle version de js/messages.js soit en ligne (c'est elle
-- qui remplit les deux colonnes à chaque envoi).
--
-- Après cette phase : je ne vois que les messages que j'ai envoyés ou reçus, et
-- je ne peux écrire qu'en mon propre nom.
-- ─────────────────────────────────────────────────────────────────────────────
-- drop policy if exists "lecture invites" on public.messages;
-- drop policy if exists "envoi invites"   on public.messages;
--
-- create policy "lecture participants" on public.messages
--   for select to authenticated
--   using (user_id = auth.uid() or dest_user_id = auth.uid());
--
-- create policy "envoi en mon nom" on public.messages
--   for insert to authenticated
--   with check (user_id = auth.uid());
