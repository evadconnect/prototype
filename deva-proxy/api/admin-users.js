// ── Administration des comptes bêta (fonction serverless Vercel) ──
//
// Deux actions, protégées par le secret admin (en-tête x-admin-secret) :
//   { action: 'list' }                        → liste des comptes avec leurs
//     profils et l'état « fiche faite » (fiches_faites) par profil.
//   { action: 'reset_onboarding', user_id }   → retire fiches_faites des
//     métadonnées du compte → l'utilisateur repassera par l'onboarding.
//
// SÉCURITÉ : clé SERVICE_ROLE uniquement côté serveur, jamais dans le front.
// Variables d'environnement (projet Vercel du proxy, déjà en place) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function sb(path, opts = {}) {
  return fetch(SUPABASE_URL + path, {
    ...opts,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: 'Bearer ' + SERVICE_ROLE,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = req.headers['x-admin-secret'];
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: 'Config Supabase manquante (SUPABASE_URL / SERVICE_ROLE)' });
  }

  const body = (typeof req.body === 'object' && req.body) || {};
  const action = body.action || 'list';

  try {
    if (action === 'list') {
      // Liste paginée (largement suffisant pour la bêta).
      const r = await sb('/auth/v1/admin/users?page=1&per_page=200');
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: 'Lecture des comptes impossible', http: r.status, detail: data });
      const users = (Array.isArray(data) ? data : data.users || [])
        // Ignore les comptes supprimés (GoTrue peut renvoyer des lignes
        // soft-deleted : deleted_at renseigné) → n'apparaissent plus dans la liste.
        .filter((u) => !u.deleted_at)
        .map((u) => {
        const meta = u.user_metadata || {};
        return {
          id: u.id,
          email: u.email,
          prenom: meta.prenom || '',
          nom: meta.nom || '',
          roles: Array.isArray(meta.roles) ? meta.roles : (meta.role ? [meta.role] : []),
          fiches_faites: Array.isArray(meta.fiches_faites) ? meta.fiches_faites : [],
          created_at: u.created_at || null,
          last_sign_in_at: u.last_sign_in_at || null,
        };
      });
      users.sort((a, b) => String(a.email).localeCompare(String(b.email)));
      return res.status(200).json({ total: users.length, users });
    }

    if (action === 'reset_onboarding') {
      const userId = String(body.user_id || '').trim();
      if (!userId) return res.status(400).json({ error: 'user_id manquant' });
      // Optionnel : ne réinitialiser QU'UN profil. Sans role → tous les profils.
      const role = String(body.role || '').trim();

      // Lire les métadonnées actuelles, retirer fiches_faites, réécrire le tout.
      const getRes = await sb('/auth/v1/admin/users/' + encodeURIComponent(userId));
      const user = await getRes.json();
      if (!getRes.ok) return res.status(500).json({ error: 'Compte introuvable', http: getRes.status, detail: user });

      // GoTrue FUSIONNE user_metadata : retirer la clé ne l'efface pas côté
      // serveur. On force la nouvelle valeur (null = tout vider réellement).
      const cur = Array.isArray(user.user_metadata && user.user_metadata.fiches_faites) ? user.user_metadata.fiches_faites : [];
      let nouvelles;
      if (role) {
        nouvelles = cur.filter((r) => r !== role);
        if (!nouvelles.length) nouvelles = null;   // vider réellement si plus rien
      } else {
        nouvelles = null;                           // reset global (tous les profils)
      }
      const meta = Object.assign({}, user.user_metadata || {}, { fiches_faites: nouvelles });

      const putRes = await sb('/auth/v1/admin/users/' + encodeURIComponent(userId), {
        method: 'PUT',
        body: JSON.stringify({ user_metadata: meta }),
      });
      const updated = await putRes.json();
      if (!putRes.ok) return res.status(500).json({ error: 'Mise à jour impossible', http: putRes.status, detail: updated });

      return res.status(200).json({ ok: true, email: user.email, role: role || null });
    }

    if (action === 'delete_user') {
      const userId = String(body.user_id || '').trim();
      if (!userId) return res.status(400).json({ error: 'user_id manquant' });

      // 1) Supprime les fiches du compte (best effort : la cascade auth ne couvre
      //    pas toutes les tables selon leur contrainte user_id).
      const flt = '?user_id=eq.' + encodeURIComponent(userId);
      for (const t of ['fiche_pilote', 'fiche_batisseur', 'fiche_semeur', 'fiches_brouillons']) {
        try { await sb('/rest/v1/' + t + flt, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); } catch (e) {}
      }

      // 2) Supprime le compte d'authentification.
      const delRes = await sb('/auth/v1/admin/users/' + encodeURIComponent(userId), { method: 'DELETE' });
      if (!delRes.ok) {
        let detail; try { detail = await delRes.json(); } catch (e) { detail = null; }
        return res.status(500).json({ error: 'Suppression du compte impossible', http: delRes.status, detail });
      }
      return res.status(200).json({ ok: true, deleted: userId });
    }

    return res.status(400).json({ error: 'Action inconnue : ' + action });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
}
