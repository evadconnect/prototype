-- ============================================================================
--  Récolte — Déverrouillage en DOUBLE VALIDATION (escrow), atomique & idempotent
-- ----------------------------------------------------------------------------
--  Remplace l'ancienne fonction « recolte_unlock » (transfert immédiat) par
--  trois opérations, toutes appelées UNIQUEMENT par l'Edge Function
--  (clé service-role), jamais depuis le front :
--
--    recolte_reserve(...)  → le Bâtisseur RÉSERVE : place décomptée, graines
--                            bloquées (transaction « en_attente »). Rien n'est
--                            encore transféré. Accès gratuit = confirmé direct.
--    recolte_confirm(...)  → le Pilote hôte CONFIRME la remise : les graines
--                            passent réellement du Bâtisseur au Pilote.
--    recolte_cancel(...)   → annulation tant que non confirmée : la place est
--                            rendue, aucune graine ne bouge.
--
--  Aucun euro n'intervient : uniquement des graines.
--  À exécuter APRÈS supabase-recolte-migration.sql.
--  (Nécessite la colonne idempotency_key ajoutée par supabase-recolte-unlock-rpc.sql ;
--   elle est re-créée ici par sécurité.)
-- ============================================================================

alter table public.mkt_transactions
  add column if not exists idempotency_key text;
create unique index if not exists mkt_tx_idem_uidx
  on public.mkt_transactions (idempotency_key)
  where idempotency_key is not null;

-- On retire l'ancienne fonction de transfert immédiat (modèle A) si présente.
drop function if exists public.recolte_unlock(text, text, text, text, text);

-- ── 1) RÉSERVER ─────────────────────────────────────────────────────────────
create or replace function public.recolte_reserve(
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
  v_ledger  integer;
  v_blocked integer;
  v_code    text;
  v_tx_id   text;
begin
  -- Idempotence : rejouer la même clé ne réserve pas deux fois.
  if p_idempotency_key is not null and p_idempotency_key <> '' then
    select * into v_tx from public.mkt_transactions where idempotency_key = p_idempotency_key limit 1;
    if found then
      return jsonb_build_object('status','already','transaction', to_jsonb(v_tx));
    end if;
  end if;

  -- Verrou sur l'accès (atomicité des places).
  select * into v_acc from public.recolte_acces where id = p_access_id for update;
  if not found then raise exception 'ACCES_INTROUVABLE' using errcode='P0002'; end if;

  -- Garde-fou serveur : attestation « hors exploitation » obligatoire.
  if coalesce(v_acc.hors_exploitation, false) = false then
    raise exception 'HORS_EXPLOITATION_REQUIS' using errcode='P0001';
  end if;

  -- Places restantes.
  if coalesce(v_acc.places, 0) <= 0 then
    raise exception 'COMPLET' using errcode='P0001';
  end if;

  v_cost := coalesce(v_acc.graines_cost, 0);

  -- Vérif solde disponible = grand livre − déjà bloqué (réservations en attente).
  if v_cost > 0 then
    select coalesce(sum(delta),0) into v_ledger
      from public.graines_tx where party_type = p_buyer_type and party_id = p_buyer_id;
    select coalesce(sum(prix),0) into v_blocked
      from public.mkt_transactions
      where buyer_type = p_buyer_type and buyer_id = p_buyer_id and statut = 'en_attente';
    if (v_ledger - v_blocked) < v_cost then
      raise exception 'GRAINES_INSUFFISANTES' using errcode='P0001';
    end if;
  end if;

  -- Créer la transaction (en_attente si payant, confirmee si gratuit).
  v_tx_id := gen_random_uuid()::text;
  v_code  := upper(substr(md5(random()::text), 1, 6));
  insert into public.mkt_transactions(
    id, offer_id, offer_titre, prix, buyer_type, buyer_id, buyer_nom,
    seller_type, seller_id, seller_nom, code, statut, idempotency_key,
    donnees, created_at, updated_at
  ) values (
    v_tx_id, p_access_id, v_acc.titre, v_cost, p_buyer_type, p_buyer_id, p_buyer_nom,
    'pilote', v_acc.lieu_id, v_acc.lieu_nom, v_code,
    case when v_cost > 0 then 'en_attente' else 'confirmee' end,
    nullif(p_idempotency_key,''), '{}'::jsonb, now(), now()
  ) returning * into v_tx;

  -- Décompter une place. (echanges ne bouge qu'à la confirmation.)
  update public.recolte_acces
     set places     = places - 1,
         statut     = case when places - 1 <= 0 then 'full' else statut end,
         updated_at = now()
   where id = p_access_id;

  return jsonb_build_object('status','ok','transaction', to_jsonb(v_tx));
end
$$;

-- ── 2) CONFIRMER (le Pilote hôte remet l'accès) ─────────────────────────────
create or replace function public.recolte_confirm(
  p_tx_id            text,
  p_confirming_lieu  text,   -- id du lieu qui confirme (garde-fou : doit être l'hôte)
  p_idempotency_key  text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx   public.mkt_transactions%rowtype;
  v_cost integer;
begin
  select * into v_tx from public.mkt_transactions where id = p_tx_id for update;
  if not found then raise exception 'TX_INTROUVABLE' using errcode='P0002'; end if;

  -- Idempotence naturelle : déjà confirmée → on renvoie l'existante.
  if v_tx.statut = 'confirmee' then
    return jsonb_build_object('status','already','transaction', to_jsonb(v_tx));
  end if;
  if v_tx.statut <> 'en_attente' then
    raise exception 'ETAT_INVALIDE' using errcode='P0001';
  end if;

  -- Seul le lieu hôte peut confirmer.
  if p_confirming_lieu is not null and p_confirming_lieu <> ''
     and v_tx.seller_id is not null and v_tx.seller_id <> p_confirming_lieu then
    raise exception 'NON_AUTORISE' using errcode='P0001';
  end if;

  v_cost := coalesce(v_tx.prix, 0);
  if v_cost > 0 then
    -- Débit du Bâtisseur
    insert into public.graines_tx(id, party_type, party_id, delta, type, label, ref_table, ref_id, created_at)
      values (gen_random_uuid()::text, v_tx.buyer_type, v_tx.buyer_id, -v_cost, 'acces',
              'Accès déverrouillé · ' || coalesce(v_tx.offer_titre,''), 'mkt_transactions', v_tx.id, now());
    -- Crédit du Pilote hôte
    insert into public.graines_tx(id, party_type, party_id, delta, type, label, ref_table, ref_id, created_at)
      values (gen_random_uuid()::text, v_tx.seller_type, v_tx.seller_id, v_cost, 'acces',
              'Accès ouvert · ' || coalesce(v_tx.offer_titre,''), 'mkt_transactions', v_tx.id, now());
  end if;

  update public.mkt_transactions set statut = 'confirmee', updated_at = now() where id = p_tx_id;

  -- Compter le déverrouillage abouti sur l'accès.
  update public.recolte_acces
     set echanges = coalesce(echanges,0) + 1, updated_at = now()
   where id = v_tx.offer_id;

  select * into v_tx from public.mkt_transactions where id = p_tx_id;
  return jsonb_build_object('status','ok','transaction', to_jsonb(v_tx));
end
$$;

-- ── 3) ANNULER (tant que non confirmée) ─────────────────────────────────────
create or replace function public.recolte_cancel(
  p_tx_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.mkt_transactions%rowtype;
begin
  select * into v_tx from public.mkt_transactions where id = p_tx_id for update;
  if not found then raise exception 'TX_INTROUVABLE' using errcode='P0002'; end if;

  if v_tx.statut = 'annulee' then
    return jsonb_build_object('status','already','transaction', to_jsonb(v_tx));
  end if;
  if v_tx.statut <> 'en_attente' then
    raise exception 'ETAT_INVALIDE' using errcode='P0001';
  end if;

  update public.mkt_transactions set statut = 'annulee', updated_at = now() where id = p_tx_id;

  -- Rendre la place réservée.
  update public.recolte_acces
     set places     = coalesce(places,0) + 1,
         statut     = case when statut = 'full' then 'active' else statut end,
         updated_at = now()
   where id = v_tx.offer_id;

  select * into v_tx from public.mkt_transactions where id = p_tx_id;
  return jsonb_build_object('status','ok','transaction', to_jsonb(v_tx));
end
$$;

-- Réservé au rôle service (Edge Function) uniquement.
revoke all on function public.recolte_reserve(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.recolte_confirm(text,text,text)          from public, anon, authenticated;
revoke all on function public.recolte_cancel(text)                     from public, anon, authenticated;
grant execute on function public.recolte_reserve(text,text,text,text,text) to service_role;
grant execute on function public.recolte_confirm(text,text,text)          to service_role;
grant execute on function public.recolte_cancel(text)                     to service_role;
