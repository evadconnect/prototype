// ============================================================================
//  Edge Function : recolte-unlock  (déverrouillage en double validation)
// ----------------------------------------------------------------------------
//  Seul point d'écriture autorisé pour la Récolte. Le front n'écrit JAMAIS en
//  base directement : il appelle cette fonction, qui exécute la logique atomique
//  + idempotente en base (fonctions SQL recolte_reserve / recolte_confirm /
//  recolte_cancel) avec la clé service-role.
//
//  Corps attendu (JSON), selon l'action :
//    { action:'reserve', access_id, buyer_type, buyer_id, buyer_nom, idempotency_key }
//    { action:'confirm', tx_id, confirming_lieu?, idempotency_key? }
//    { action:'cancel',  tx_id }
//
//  Réponses : 200 { status:'ok'|'already', transaction:{...} } | 4xx { error, message }
//  Aucun euro : le transfert est exclusivement en graines.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function mapError(msg: string): { code: string; message: string; status: number } {
  const m = msg || "";
  if (m.includes("ACCES_INTROUVABLE")) return { code: "ACCES_INTROUVABLE", message: "Cet accès n'existe plus.", status: 404 };
  if (m.includes("TX_INTROUVABLE")) return { code: "TX_INTROUVABLE", message: "Ce déverrouillage est introuvable.", status: 404 };
  if (m.includes("HORS_EXPLOITATION_REQUIS")) return { code: "HORS_EXPLOITATION_REQUIS", message: "Accès non attesté « hors exploitation » : déverrouillage refusé.", status: 409 };
  if (m.includes("COMPLET")) return { code: "COMPLET", message: "Plus de place disponible pour cet accès.", status: 409 };
  if (m.includes("GRAINES_INSUFFISANTES")) return { code: "GRAINES_INSUFFISANTES", message: "Graines insuffisantes pour déverrouiller cet accès.", status: 402 };
  if (m.includes("ETAT_INVALIDE")) return { code: "ETAT_INVALIDE", message: "Ce déverrouillage n'est plus dans un état modifiable.", status: 409 };
  if (m.includes("NON_AUTORISE")) return { code: "NON_AUTORISE", message: "Seul le lieu hôte peut confirmer cet accès.", status: 403 };
  return { code: "ERREUR", message: "Opération impossible pour le moment.", status: 500 };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHODE", message: "POST attendu." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim();

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let rpc: string;
    let params: Record<string, unknown>;

    if (action === "reserve") {
      const access_id = String(body.access_id || "").trim();
      const buyer_type = String(body.buyer_type || "").trim();
      const buyer_id = String(body.buyer_id || "").trim();
      const buyer_nom = String(body.buyer_nom || "").trim();
      const idempotency_key = String(body.idempotency_key || "").trim();
      if (!access_id || !buyer_type || !buyer_id || !idempotency_key) {
        return json({ error: "PARAMS", message: "access_id, buyer_type, buyer_id et idempotency_key sont requis." }, 400);
      }
      rpc = "recolte_reserve";
      params = { p_access_id: access_id, p_buyer_type: buyer_type, p_buyer_id: buyer_id, p_buyer_nom: buyer_nom, p_idempotency_key: idempotency_key };
    } else if (action === "confirm") {
      const tx_id = String(body.tx_id || "").trim();
      if (!tx_id) return json({ error: "PARAMS", message: "tx_id requis." }, 400);
      rpc = "recolte_confirm";
      params = { p_tx_id: tx_id, p_confirming_lieu: String(body.confirming_lieu || "").trim(), p_idempotency_key: String(body.idempotency_key || "").trim() };
    } else if (action === "cancel") {
      const tx_id = String(body.tx_id || "").trim();
      if (!tx_id) return json({ error: "PARAMS", message: "tx_id requis." }, 400);
      rpc = "recolte_cancel";
      params = { p_tx_id: tx_id };
    } else {
      return json({ error: "ACTION", message: "action doit être reserve, confirm ou cancel." }, 400);
    }

    const { data, error } = await admin.rpc(rpc, params);
    if (error) {
      const e = mapError(error.message);
      return json({ error: e.code, message: e.message }, e.status);
    }
    return json(data, 200);
  } catch (_e) {
    return json({ error: "ERREUR", message: "Requête invalide." }, 400);
  }
});
