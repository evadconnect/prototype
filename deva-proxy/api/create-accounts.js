// ── Création automatique des comptes bêta (fonction serverless Vercel) ──
//
// Lit la table `inscription_beta`, crée un compte Supabase Auth pour chaque
// inscrit passé à « approuvé », lui envoie ses identifiants par email (Brevo),
// puis marque la ligne « compte_créé ».
//
// SÉCURITÉ :
//   - Utilise la clé SERVICE_ROLE (toute-puissante) → UNIQUEMENT côté serveur.
//   - Protégée par un secret admin (en-tête x-admin-secret).
//   - N'agit QUE sur les lignes « approuvé » : elle ne peut pas créer de compte
//     arbitraire, seulement pour des gens déjà validés par l'équipe.
//
// Variables d'environnement Vercel à définir (projet du proxy) :
//   SUPABASE_URL                = https://lmhhrccmgebztioesmik.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = la clé « service_role » (secret, JAMAIS dans le front)
//   ADMIN_SECRET                = un long secret aléatoire (gate de la fonction)
//   BREVO_API_KEY               = clé API Brevo (envoi des emails)
//   SENDER_EMAIL                = expéditeur vérifié dans Brevo (défaut contact@evad.org)
//   SENDER_NAME                 = nom expéditeur (défaut EVAD)

import { randomBytes } from 'crypto';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_ROLE  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET  = process.env.ADMIN_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL  = process.env.SENDER_EMAIL || 'contact@evad.org';
const SENDER_NAME   = process.env.SENDER_NAME  || 'EVAD';
const APP_URL       = 'https://app.evad.org';

// Mot de passe aléatoire lisible (12 caractères, sans caractères ambigus).
function genPassword() {
  return randomBytes(12).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
}

// Profils autorisés d'une inscription : cases acces_pilote/batisseur/semeur
// cochées, sinon repli sur le champ `role` (profil d'inscription).
function parseRoles(row) {
  const list = [];
  if (row.acces_pilote) list.push('pilote');
  if (row.acces_batisseur) list.push('batisseur');
  if (row.acces_semeur) list.push('semeur');
  if (!list.length) {
    const valid = ['pilote', 'batisseur', 'semeur'];
    list.push(valid.indexOf(row.role) !== -1 ? row.role : 'batisseur');
  }
  return list;
}

// Appel REST/Auth Supabase avec la clé service_role.
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

async function sendWelcomeEmail(row, email, password) {
  if (!BREVO_API_KEY) return { ok: false, error: 'BREVO_API_KEY manquante' };
  const prenom = (row.prenom || '').trim();
  const roleLabel = (row.role_label || '').trim();
  const profilLine = roleLabel
    ? '<p style="font-size:14px;color:#3d6b5a;margin:0 0 18px">Ton profil : <b style="color:#018262">' + roleLabel + '</b></p>'
    : '';

  const html =
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef5f1;padding:24px 12px;font-family:Arial,Helvetica,sans-serif"><tr><td align="center">' +
    '<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.06)">' +
      // En-tête vert
      '<tr><td style="background:#018262;padding:26px 32px;text-align:center">' +
        '<img src="https://www.evad.org/assets/logo-evad-blanc.png" alt="EVAD" width="140" height="66" style="display:inline-block;width:140px;height:66px;border:0;outline:none;text-decoration:none">' +
        '<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#cdeee3;margin-top:6px">Espace bêta-testeurs</div>' +
      '</td></tr>' +
      // Corps
      '<tr><td style="padding:30px 32px 8px">' +
        '<p style="font-size:16px;color:#0d2b22;margin:0 0 14px">Bonjour ' + (prenom || '') + ',</p>' +
        '<p style="font-size:15px;line-height:1.6;color:#3d6b5a;margin:0 0 18px">Ton accès à la bêta EVAD est ouvert 🌱 Merci de faire partie des premières personnes à faire grandir l\'écosystème avec nous.</p>' +
        profilLine +
        // Encart identifiants
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f8f5;border:1px solid #d7ece3;border-radius:12px;margin:0 0 22px"><tr><td style="padding:16px 18px;font-size:14px;color:#0d2b22;line-height:1.7">' +
          '<div style="color:#3d6b5a;font-size:12px">Identifiant</div><div><b>' + email + '</b></div>' +
          '<div style="color:#3d6b5a;font-size:12px;margin-top:10px">Mot de passe</div><div><b style="font-family:monospace;font-size:15px">' + password + '</b></div>' +
        '</td></tr></table>' +
        // Bouton
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">' +
          '<a href="' + APP_URL + '" style="display:inline-block;background:#018262;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:100px">Accéder à la bêta →</a>' +
        '</td></tr></table>' +
        '<p style="font-size:13px;color:#3d6b5a;line-height:1.6;margin:20px 0 0;text-align:center">Sur la page d\'accueil, clique sur «&nbsp;Déjà inscrit·e ? Se connecter&nbsp;».</p>' +
      '</td></tr>' +
      // Pied
      '<tr><td style="padding:24px 32px;border-top:1px solid #eef2f0;text-align:center">' +
        '<p style="font-size:13px;color:#3d6b5a;margin:0 0 4px">À très vite dans l\'écosystème 🌿</p>' +
        '<p style="font-size:13px;color:#0d2b22;font-weight:700;margin:0">L\'équipe EVAD</p>' +
        '<p style="font-size:11px;color:#9db3aa;margin:12px 0 0">EVAD · Écosystème Vivant Autonome &amp; Décentralisé</p>' +
      '</td></tr>' +
    '</table></td></tr></table>';

  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email, name: ((prenom + ' ' + (row.nom || '')).trim()) || email }],
      subject: 'Ton accès à la bêta EVAD est prêt 🌱',
      htmlContent: html,
    }),
  });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status;
    try { msg = (await r.json()).message || msg; } catch (e) {}
    return { ok: false, error: msg };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Gate admin
  const secret = req.headers['x-admin-secret'];
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return res.status(500).json({ error: 'Config Supabase manquante (SUPABASE_URL / SERVICE_ROLE)' });
  }

  try {
    // 1. Inscrits approuvés (pas encore de compte)
    const listRes = await sb(
      '/rest/v1/inscription_beta?statut=eq.' + encodeURIComponent('approuvé') +
      '&select=id,email,prenom,nom,role,role_label,acces_pilote,acces_batisseur,acces_semeur'
    );
    const rows = await listRes.json();
    if (!Array.isArray(rows)) {
      return res.status(500).json({
        error: 'Lecture inscription_beta impossible',
        http: listRes.status,
        detail: rows,
      });
    }

    const results = [];
    for (const row of rows) {
      const email = String(row.email || '').trim().toLowerCase();
      if (!email) { results.push({ id: row.id, ok: false, error: 'email vide' }); continue; }

      const password = genPassword();
      const roles = parseRoles(row);

      // 2. Créer le compte
      const createRes = await sb('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            roles: roles,        // profils autorisés (multi-profil)
            role: roles[0],      // profil principal (compat)
            prenom: row.prenom || '',
            nom: row.nom || '',
          },
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        results.push({
          id: row.id, email, ok: false,
          error: created.msg || created.error_description || created.error || ('HTTP ' + createRes.status),
        });
        continue;
      }

      // 3. Email d'accueil (Brevo)
      const mail = await sendWelcomeEmail(row, email, password);

      // 4. Marquer la ligne « compte_créé »
      await sb('/rest/v1/inscription_beta?id=eq.' + encodeURIComponent(row.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ statut: 'compte_créé', compte_cree_at: new Date().toISOString() }),
      });

      results.push({ id: row.id, email, ok: true, mailOk: mail.ok, mailError: mail.error || null });
    }

    const crees = results.filter(r => r.ok).length;
    return res.status(200).json({ traite: results.length, comptes_crees: crees, results });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e) });
  }
}
