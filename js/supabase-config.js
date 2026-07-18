(function (global) {
  'use strict';
  const url = 'https://lmhhrccmgebztioesmik.supabase.co';
  const publishableKey = 'sb_publishable_M_1-SinRmo1T8exi8_gkvw_RTiHznag';
  if (!global.supabase || !global.supabase.createClient) {
    console.error('Le SDK Supabase n\'est pas charge.');
    return;
  }
  global.evadSupabase = global.supabase.createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})(window);
