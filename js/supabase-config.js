(function (global) {
  'use strict';

  // ── Choix de la base selon le domaine ──────────────────────────────
  // PROD (app.evad.org)  → vraies données des bêta-testeurs.
  // Ailleurs (préview dev, local) → base de STAGING « evad-dev » (copie
  // de test, isolée : l'équipe peut tout tester sans toucher la prod).
  const PROD = {
    url: 'https://lmhhrccmgebztioesmik.supabase.co',
    key: 'sb_publishable_M_1-SinRmo1T8exi8_gkvw_RTiHznag'
  };
  const STAGING = {
    url: 'https://mpoyfsisbaggvpdpajfo.supabase.co',
    key: 'sb_publishable_dFNImcmV00s3o43crCNfvw_5TdFtzfT'
  };

  const PROD_HOSTS = ['app.evad.org'];
  const isProd = PROD_HOSTS.includes(global.location.hostname);
  const cfg = isProd ? PROD : STAGING;

  // Exposé pour les appels REST directs (feedback, contributions).
  global.EVAD_SUPABASE_ENV = { isProd: isProd, url: cfg.url, key: cfg.key };

  if (!global.supabase || !global.supabase.createClient) {
    console.error('Le SDK Supabase n\'est pas charge.');
    return;
  }
  global.evadSupabase = global.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  console.log('[EVAD] Base Supabase :', isProd ? 'PROD' : 'STAGING (evad-dev)', '—', cfg.url);
})(window);
