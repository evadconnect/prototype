// ── Protection de la préview dev par un mot de passe PARTAGÉ (HTTP Basic Auth) ──
//
// Un seul identifiant/mot de passe pour toute l'équipe. Chacun le saisit une
// fois, le navigateur le retient. Le mot de passe est lu depuis les variables
// d'environnement Vercel (jamais dans le code / le dépôt).
//
// À configurer dans Vercel → Settings → Environment Variables :
//   DEV_PREVIEW_PASSWORD = le mot de passe partagé   (obligatoire pour activer)
//   DEV_PREVIEW_USER     = l'identifiant partagé      (optionnel, défaut « evad »)
//
// Tant que DEV_PREVIEW_PASSWORD n'est pas définie, la protection est INACTIVE
// (on laisse passer) pour ne rien bloquer par erreur pendant la mise en place.

export const config = {
  // Protège toutes les routes.
  matcher: '/:path*',
};

export default function middleware(request) {
  const PASS = process.env.DEV_PREVIEW_PASSWORD;
  if (!PASS) return; // pas encore configuré → accès libre

  const USER = process.env.DEV_PREVIEW_USER || 'evad';
  const header = request.headers.get('authorization') || '';

  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const idx = decoded.indexOf(':');
      const user = decoded.slice(0, idx);
      const pass = decoded.slice(idx + 1);
      if (user === USER && pass === PASS) return; // identifiants OK → on laisse passer
    } catch (e) { /* en-tête malformé → on redemande */ }
  }

  return new Response('Accès réservé à l’équipe EVAD.', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="EVAD dev", charset="UTF-8"',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
