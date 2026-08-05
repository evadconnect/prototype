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
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email, name: ((prenom + ' ' + (row.nom || '')).trim()) || email }],
      subject: 'Ton accès à la bêta EVAD est prêt 🌱',
      htmlContent:
        '<div style="font-family:Arial,sans-serif;color:#0d2b22;line-height:1.6;font-size:15px">' +
        '<p>Bonjour ' + (prenom || '') + ',</p>' +
        '<p>Bonne nouvelle : ton accès à la bêta EVAD est ouvert 🎉<br>Tu peux te connecter dès maintenant.</p>' +
        '<p style="background:#f2f8f5;border-radius:10px;padding:14px 16px">' +
        '<b>Adresse :</b> <a href="' + APP_URL + '">' + APP_URL + '</a><br>' +
        '<b>Identifiant :</b> ' + email + '<br>' +
        '<b>Mot de passe :</b> <code>' + password + '</code>' +
        '</p>' +
        '<p>Sur la page d’accueil, clique sur « <b>Déjà inscrit·e ? Se connecter</b> ».</p>' +
        '<p>Merci de faire partie de l’aventure 🌿<br>L’équipe EVAD</p>' +
        '</div>',
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
      '&select=id,email,prenom,nom,role'
    );
    const rows = await listRes.json();
    if (!Array.isArray(rows)) {
      return res.status(500).json({ error: 'Lecture inscription_beta impossible', detail: rows });
    }

    const results = [];
    for (const row of rows) {
      const email = String(row.email || '').trim().toLowerCase();
      if (!email) { results.push({ id: row.id, ok: false, error: 'email vide' }); continue; }

      const password = genPassword();

      // 2. Créer le compte
      const createRes = await sb('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            role: row.role || 'batisseur',
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
