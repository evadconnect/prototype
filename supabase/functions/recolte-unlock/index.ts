// ============================================================================
//  Edge Function : recolte-unlock
// ----------------------------------------------------------------------------
//  Seul point d'entrée autorisé pour déverrouiller un accès de la Récolte.
//  Le front n'écrit JAMAIS en base directement : il appelle cette fonction, qui
//  exécute la logique atomique + idempotente en base (fonction SQL recolte_unlock)
//  avec la clé service-role.
//
//  Corps attendu (JSON) :
//    { access_id, buyer_type, buyer_id, buyer_nom, idempotency_key }
//
//  Réponses :
//    200 { status:'ok'|'already', transaction:{...} }
//    4xx { error:'CODE', message:'...' }
//
//  Aucun euro : le transfert est exclusivement en graines.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mappe les erreurs SQL vers un code + message clair côté client.
function mapError(msg: string): { code: string; message: string; status: number } {
  const m = msg || "";
  if (m.includes("ACCES_INTROUVABLE")) return { code: "ACCES_INTROUVABLE", message: "Cet accès n'existe plus.", status: 404 };
  if (m.includes("HORS_EXPLOITATION_REQUIS")) return { code: "HORS_EXPLOITATION_REQUIS", message: "Accès non attesté « hors exploitation » : déverrouillage refusé.", status: 409 };
  if (m.includes("COMPLET")) return { code: "COMPLET", message: "Plus de place disponible pour cet accès.", status: 409 };
  if (m.includes("GRAINES_INSUFFISANTES")) return { code: "GRAINES_INSUFFISANTES", message: "Graines insuffisantes pour déverrouiller cet accès.", status: 402 };
  return { code: "ERREUR", message: "Déverrouillage impossible pour le moment.", status: 500 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "METHODE", message: "POST attendu." }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const access_id = String(body.access_id || "").trim();
    const buyer_type = String(body.buyer_type || "").trim();
    const buyer_id = String(body.buyer_id || "").trim();
    const buyer_nom = String(body.buyer_nom || "").trim();
    const idempotency_key = String(body.idempotency_key || "").trim();

    if (!access_id || !buyer_type || !buyer_id || !idempotency_key) {
      return new Response(
        JSON.stringify({ error: "PARAMS", message: "access_id, buyer_type, buyer_id et idempotency_key sont requis." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Client service-role : injecté automatiquement dans les Edge Functions.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await admin.rpc("recolte_unlock", {
      p_access_id: access_id,
      p_buyer_type: buyer_type,
      p_buyer_id: buyer_id,
      p_buyer_nom: buyer_nom,
      p_idempotency_key: idempotency_key,
    });

    if (error) {
      const e = mapError(error.message);
      return new Response(JSON.stringify({ error: e.code, message: e.message }), {
        status: e.status, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "ERREUR", message: "Requête invalide." }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
