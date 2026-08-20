-- ============================================================================
--  Récolte — Déverrouillage atomique & idempotent (cœur en base)
-- ----------------------------------------------------------------------------
--  Cette fonction est appelée UNIQUEMENT par l'Edge Function « recolte-unlock »
--  (avec la clé service-role). Elle n'est jamais appelée depuis le front.
--
--  Elle fait, dans UNE transaction atomique :
--    1. idempotence : si la clé a déjà été traitée, renvoie le résultat existant
--    2. verrouille l'accès (FOR UPDATE) → pas de course sur les places
--    3. garde-fou serveur : refuse si hors_exploitation n'est pas coché
--    4. refuse s'il ne reste plus de place
--    5. pour un accès payant : vérifie le solde du Bâtisseur, DÉBITE le Bâtisseur
--       et CRÉDITE le Pilote (deux écritures graines_tx)
--    6. décrémente les places, journalise la transaction
--
--  Aucun euro n'intervient : tout est en graines.
--  À exécuter APRÈS supabase-recolte-migration.sql.
-- ============================================================================

-- Clé d'idempotence sur les transactions (une par intention de déverrouillage)
alter table public.mkt_transactions
  add column if not exists idempotency_key text;
create unique index if not exists mkt_tx_idem_uidx
  on public.mkt_transactions (idempotency_key)
  where idempotency_key is not null;

create or replace function public.recolte_unlock(
  p_access_id       text,
  p_buyer_type      text,
  p_buyer_id        text,
  p_buyer_nom       text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc     public.recolte_acces%rowtype;
  v_tx      public.mkt_transactions%rowtype;
  v_cost    integer;
  v_balance integer;
  v_code    text;
  v_tx_id   text;
begin
  -- 1) Idempotence : rejouer une clé déjà traitée ne re-débite pas.
  if p_idempotency_key is not null then
    select * into v_tx from public.mkt_transactions
      where idempotency_key = p_idempotency_key limit 1;
    if found then
      return jsonb_build_object('status','already','transaction', to_jsonb(v_tx));
    end if;
  end if;

  -- 2) Verrou sur l'accès (atomicité des places)
  select * into v_acc from public.recolte_acces where id = p_access_id for update;
  if not found then raise exception 'ACCES_INTROUVABLE' using errcode='P0002'; end if;

  -- 3) Garde-fou serveur (non contournable) : attestation « hors exploitation »
  if coalesce(v_acc.hors_exploitation, false) = false then
    raise exception 'HORS_EXPLOITATION_REQUIS' using errcode='P0001';
  end if;

  -- 4) Places restantes
  if coalesce(v_acc.places, 0) <= 0 then
    raise exception 'COMPLET' using errcode='P0001';
  end if;

  v_cost := coalesce(v_acc.graines_cost, 0);

  -- 5) Accès payant : vérif solde puis transfert Bâtisseur -> Pilote
  if v_cost > 0 then
    select coalesce(sum(delta), 0) into v_balance
      from public.graines_tx
      where party_type = p_buyer_type and party_id = p_buyer_id;
    if v_balance < v_cost then
      raise exception 'GRAINES_INSUFFISANTES' using errcode='P0001';
    end if;

    -- Débit du Bâtisseur
    insert into public.graines_tx(id, party_type, party_id, delta, type, label, ref_table, ref_id, created_at)
      values (gen_random_uuid()::text, p_buyer_type, p_buyer_id, -v_cost, 'acces',
              'Accès déverrouillé · ' || coalesce(v_acc.titre,''), 'recolte_acces', p_access_id, now());
    -- Crédit du Pilote hôte (le lieu qui a ouvert l'accès)
    insert into public.graines_tx(id, party_type, party_id, delta, type, label, ref_table, ref_id, created_at)
      values (gen_random_uuid()::text, 'pilote', v_acc.lieu_id, v_cost, 'acces',
              'Accès ouvert · ' || coalesce(v_acc.titre,''), 'recolte_acces', p_access_id, now());
  end if;

  -- 6) Journaliser la transaction (statut confirmee : transfert immédiat)
  v_tx_id := gen_random_uuid()::text;
  v_code  := upper(substr(md5(random()::text), 1, 6));
  insert into public.mkt_transactions(
    id, offer_id, offer_titre, prix, buyer_type, buyer_id, buyer_nom,
    seller_type, seller_id, seller_nom, code, statut, idempotency_key,
    donnees, created_at, updated_at
  ) values (
    v_tx_id, p_access_id, v_acc.titre, v_cost, p_buyer_type, p_buyer_id, p_buyer_nom,
    'pilote', v_acc.lieu_id, v_acc.lieu_nom, v_code, 'confirmee', p_idempotency_key,
    '{}'::jsonb, now(), now()
  ) returning * into v_tx;

  -- Décrément atomique des places
  update public.recolte_acces
     set places    = places - 1,
         echanges  = coalesce(echanges, 0) + 1,
         statut    = case when places - 1 <= 0 then 'full' else statut end,
         updated_at = now()
   where id = p_access_id;

  return jsonb_build_object('status','ok','transaction', to_jsonb(v_tx));
end
$$;

-- La fonction n'est appelable que par le rôle service (Edge Function), pas par
-- les clients anon/authenticated.
revoke all on function public.recolte_unlock(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.recolte_unlock(text,text,text,text,text) to service_role;
