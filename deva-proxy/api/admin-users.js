// ── Administration des comptes bêta (fonction serverless Vercel) ──
//
// Actions, protégées par le secret admin (en-tête x-admin-secret) :
//   { action: 'list' }                        → liste des comptes avec leurs
//     profils et l'état « fiche faite » (fiches_faites) par profil.
//   { action: 'reset_onboarding', user_id }   → retire fiches_faites des
//     métadonnées du compte → l'utilisateur repassera par l'onboarding.
//   { action: 'update_email', user_id, email }→ change l'email de connexion.
//   { action: 'reset_password', user_id }     → génère un nouveau mot de passe
//     et le renvoie (l'admin le transmet à l'utilisateur).
//   { action: 'remove_role', user_id, role }  → retire un profil du compte.
//   { action: 'delete_user', user_id }        → supprime le compte + ses données.
//
// SÉCURITÉ : clé SERVICE_ROLE uniquement côté serveur, jamais dans le front.
// Variables d'environnement (projet Vercel du proxy, déjà en place) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET

import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Génère un mot de passe lisible de 12 caractères (même logique que create-accounts.js).
function genPassword() {
  return randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

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

    if (action === 'update_email') {
      const userId = String(body.user_id || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      if (!userId) return res.status(400).json({ error: 'user_id manquant' });
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: 'Email invalide' });
      }
      // email_confirm: true → l'adresse est confirmée d'office (pas d'email de
      // validation à cliquer), le compte reste utilisable immédiatement.
      const putRes = await sb('/auth/v1/admin/users/' + encodeURIComponent(userId), {
        method: 'PUT',
        body: JSON.stringify({ email, email_confirm: true }),
      });
      const updated = await putRes.json();
      if (!putRes.ok) return res.status(500).json({ error: 'Changement d\'email impossible', http: putRes.status, detail: updated });
      return res.status(200).json({ ok: true, email });
    }

    if (action === 'reset_password') {
      const userId = String(body.user_id || '').trim();
      if (!userId) return res.status(400).json({ error: 'user_id manquant' });
      // Nouveau mot de passe généré côté serveur puis renvoyé à l'admin (qui le
      // transmet à l'utilisateur). Pas d'email automatique ici.
      const password = genPassword();
      const putRes = await sb('/auth/v1/admin/users/' + encodeURIComponent(userId), {
        method: 'PUT',
        body: JSON.stringify({ password }),
      });
      const updated = await putRes.json();
      if (!putRes.ok) return res.status(500).json({ error: 'Renouvellement impossible', http: putRes.status, detail: updated });
      return res.status(200).json({ ok: true, email: updated.email || null, password });
    }

    if (action === 'remove_role') {
      const userId = String(body.user_id || '').trim();
      const role = String(body.role || '').trim();
      if (!userId) return res.status(400).json({ error: 'user_id manquant' });
      if (!role) return res.status(400).json({ error: 'role manquant' });

      const getRes = await sb('/auth/v1/admin/users/' + encodeURIComponent(userId));
      const user = await getRes.json();
      if (!getRes.ok) return res.status(500).json({ error: 'Compte introuvable', http: getRes.status, detail: user });

      const meta = Object.assign({}, user.user_metadata || {});
      const curRoles = Array.isArray(meta.roles) ? meta.roles : (meta.role ? [meta.role] : []);
      const roles = curRoles.filter((r) => r !== role);
      const fiches = (Array.isArray(meta.fiches_faites) ? meta.fiches_faites : []).filter((r) => r !== role);
      meta.roles = roles;
      meta.fiches_faites = fiches.length ? fiches : null;
      if (meta.role === role) meta.role = roles[0] || null;   // compat ancien champ « role »

      const putRes = await sb('/auth/v1/admin/users/' + encodeURIComponent(userId), {
        method: 'PUT',
        body: JSON.stringify({ user_metadata: meta }),
      });
      const updated = await putRes.json();
      if (!putRes.ok) return res.status(500).json({ error: 'Mise à jour impossible', http: putRes.status, detail: updated });

      // Supprime la fiche du profil retiré (ses données propres).
      const table = { pilote: 'fiche_pilote', batisseur: 'fiche_batisseur', semeur: 'fiche_semeur' }[role];
      if (table) {
        try { await sb('/rest/v1/' + table + '?user_id=eq.' + encodeURIComponent(userId), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); } catch (e) {}
      }
      return res.status(200).json({ ok: true, email: user.email, role, roles });
    }

    if (action === 'delete_user') {
      const userId = String(body.user_id || '').trim();
      if (!userId) return res.status(400).json({ error: 'user_id manquant' });

      // 1) Supprime TOUTES les données liées au compte AVANT de supprimer le
      //    compte : une seule contrainte FK non-cascade (référençant auth.users)
      //    suffirait à faire échouer la suppression du compte. On couvre large.
      const flt = '?user_id=eq.' + encodeURIComponent(userId);
      const tables = [
        'lieu_quetes', 'lieu_solutions', 'lieu_indicateurs',
        'quete_preuves', 'quete_candidatures', 'financements',
        'graines_tx', 'mkt_transactions', 'offres_mkt',
        'fiche_pilote', 'fiche_batisseur', 'fiche_semeur', 'fiches_brouillons',
      ];
      const purge = [];
      for (const t of tables) {
        try {
          const r = await sb('/rest/v1/' + t + flt, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
          if (!r.ok && r.status !== 404) { let d; try { d = await r.json(); } catch (e) {} purge.push({ table: t, http: r.status, detail: d }); }
        } catch (e) { purge.push({ table: t, error: String(e) }); }
      }

      // 2) Supprime le compte d'authentification (hard delete).
      //    IMPORTANT : GoTrue attend un CORPS JSON sur ce DELETE (comme le fait
      //    supabase-js). Un DELETE avec Content-Type: application/json mais sans
      //    corps fait échouer le parse côté serveur → la suppression « ne faisait
      //    rien ». On envoie donc { should_soft_delete: false } (hard delete).
      const delRes = await sb('/auth/v1/admin/users/' + encodeURIComponent(userId), {
        method: 'DELETE',
        body: JSON.stringify({ should_soft_delete: false }),
      });
      if (!delRes.ok) {
        let detail; try { detail = await delRes.json(); } catch (e) { detail = null; }
        return res.status(500).json({ error: 'Suppression du compte impossible', http: delRes.status, detail, purge });
      }
      return res.status(200).json({ ok: true, deleted: userId, purge });
    }

    // ── Inscriptions bêta : lister et éditer (statut + accès profils) ──
    // Permet de tout piloter depuis la page admin, sans passer par Supabase :
    // approuver un inscrit et choisir ses profils, avant de créer les comptes.
    if (action === 'list_inscriptions') {
      const r = await sb('/rest/v1/inscription_beta?select=*');
      const rows = await r.json();
      if (!r.ok) return res.status(500).json({ error: 'Lecture inscription_beta impossible', http: r.status, detail: rows });
      const list = (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.id,
        email: row.email || '',
        prenom: row.prenom || '',
        nom: row.nom || '',
        role: row.role || '',
        role_label: row.role_label || '',
        // Champs du formulaire d'inscription (noms variables selon le site → replis).
        ville: row.ville || row.commune || row.localisation || '',
        structure: row.structure || row.organisation || row.nom_structure || row.entreprise || '',
        statut: row.statut || 'nouveau',
        acces_pilote: !!row.acces_pilote,
        acces_batisseur: !!row.acces_batisseur,
        acces_semeur: !!row.acces_semeur,
        created_at: row.created_at || null,
        compte_cree_at: row.compte_cree_at || null,
      }));
      // Tri : nouveaux d'abord, puis approuvés, puis créés ; récents en tête.
      const rank = { 'nouveau': 0, 'approuvé': 1, 'compte_créé': 2 };
      list.sort((a, b) => {
        const ra = (rank[a.statut] != null) ? rank[a.statut] : 3;
        const rb = (rank[b.statut] != null) ? rank[b.statut] : 3;
        return ra - rb || String(b.created_at || '').localeCompare(String(a.created_at || ''));
      });
      return res.status(200).json({ total: list.length, inscriptions: list });
    }

    if (action === 'create_inscription') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ error: 'Email invalide' });
      }
      const row = {
        email: email,
        prenom: String(body.prenom || '').trim(),
        nom: String(body.nom || '').trim(),
        ville: String(body.ville || '').trim(),
        structure: String(body.structure || '').trim(),
        acces_pilote: !!body.acces_pilote,
        acces_batisseur: !!body.acces_batisseur,
        acces_semeur: !!body.acces_semeur,
        statut: 'nouveau',
      };
      // Rôle principal (compat) = premier accès coché.
      const roles = [];
      if (row.acces_pilote) roles.push('pilote');
      if (row.acces_batisseur) roles.push('batisseur');
      if (row.acces_semeur) roles.push('semeur');
      if (roles.length) row.role = roles[0];

      const insert = (payload) => sb('/rest/v1/inscription_beta', {
        method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload),
      });
      let r = await insert(row);
      let created = await r.json();
      if (!r.ok) {
        // Repli : colonnes ville/structure peut-être absentes/nommées autrement.
        const core = Object.assign({}, row); delete core.ville; delete core.structure;
        r = await insert(core);
        created = await r.json();
        if (!r.ok) return res.status(500).json({ error: 'Création impossible', http: r.status, detail: created });
      }
      return res.status(200).json({ ok: true, inscription: Array.isArray(created) ? created[0] : created });
    }

    if (action === 'update_inscription') {
      const id = String(body.id || '').trim();
      if (!id) return res.status(400).json({ error: 'id manquant' });
      const patch = {};
      const VALID_STATUTS = ['nouveau', 'approuvé', 'compte_créé'];
      if (typeof body.statut === 'string' && VALID_STATUTS.indexOf(body.statut) !== -1) patch.statut = body.statut;
      ['acces_pilote', 'acces_batisseur', 'acces_semeur'].forEach((k) => {
        if (typeof body[k] === 'boolean') patch[k] = body[k];
      });
      if (!Object.keys(patch).length) return res.status(400).json({ error: 'Rien à mettre à jour' });
      const r = await sb('/rest/v1/inscription_beta?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      });
      const updated = await r.json();
      if (!r.ok) return res.status(500).json({ error: 'Mise à jour impossible', http: r.status, detail: updated });
      return res.status(200).json({ ok: true, inscription: Array.isArray(updated) ? updated[0] : updated });
    }

    return res.status(400).json({ error: 'Action inconnue : ' + action });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
}
