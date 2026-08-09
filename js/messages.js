/* EVAD · messages.js
   Messagerie interne légère (fils de discussion entre utilisateurs).
   - Backend : table Supabase `messages` + Realtime.
   - Repli : localStorage (fonctionne hors-ligne / avant exécution du SQL),
     sans temps réel mais sans perte de la conversation locale.
   Ouverture : evadOpenChat(threadId, { title, sub, quete_id, lieu_id, dest_id }).
*/
(function (global) {
  'use strict';

  var LS_KEY = 'evad:v1:messages';
  var _state = { threadId: null, chan: null, seen: null, meta: null };

  function uuid() {
    try { if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID(); } catch (e) {}
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function relTime(iso) {
    if (!iso) return '';
    try {
      var min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
      if (min < 1) return "à l'instant";
      if (min < 60) return 'il y a ' + min + ' min';
      var h = Math.floor(min / 60);
      if (h < 24) return 'il y a ' + h + ' h';
      return 'il y a ' + Math.floor(h / 24) + ' j';
    } catch (e) { return ''; }
  }

  // ── Repli localStorage ──
  function lsAll() {
    try { return JSON.parse(global.localStorage.getItem(LS_KEY) || '[]') || []; } catch (e) { return []; }
  }
  function lsWrite(rows) {
    try { global.localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(-500))); } catch (e) {}
  }
  function lsUpsert(m) {
    var rows = lsAll();
    if (!rows.some(function (r) { return r.id === m.id; })) { rows.push(m); lsWrite(rows); }
  }

  // Identité de l'utilisateur courant (selon son rôle).
  // NB : currentRole / myLieuData / batFicheData / semFicheData sont des
  // bindings lexicaux de haut niveau (let dans app-core), PAS des propriétés
  // de window — on les lit par nom nu, pas via global.
  function evadChatMe() {
    var role = (typeof currentRole !== 'undefined' && currentRole) ? currentRole : 'batisseur';
    var id = null, nom = null;
    try {
      if (role === 'pilote') {
        id = (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.id) || 'pilote';
        nom = (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.nom) || 'Pilote';
      } else if (role === 'semeur') {
        id = (typeof _currentSemeurId === 'function') ? _currentSemeurId() : 'semeur';
        nom = (typeof semFicheData !== 'undefined' && semFicheData && semFicheData.nom) || 'Semeur';
      } else {
        id = (typeof _currentBatisseurId === 'function') ? _currentBatisseurId() : 'batisseur';
        var p = (typeof batFicheData !== 'undefined' && batFicheData) ? batFicheData : {};
        nom = ((p.prenom || '') + ' ' + (p.nom || '')).trim() || 'Bâtisseur';
      }
    } catch (e) { id = id || 'anon'; }
    return { role: role, id: id, nom: nom };
  }

  // Fil déterministe Pilote ↔ Bâtisseur autour d'une quête.
  function evadChatThreadQuete(queteId, batisseurId) {
    return 'q:' + (queteId || 'x') + ':' + (batisseurId || 'x');
  }

  // ── Chargement des messages d'un fil ──
  async function loadThread(threadId) {
    var out = [];
    if (global.evadSupabase) {
      try {
        var r = await global.evadSupabase.from('messages').select('*')
          .eq('thread_id', threadId).order('created_at', { ascending: true });
        if (!r.error && Array.isArray(r.data)) {
          out = r.data;
          out.forEach(lsUpsert); // miroir local
          return out;
        }
      } catch (e) {}
    }
    // Repli local
    return lsAll().filter(function (m) { return m.thread_id === threadId; })
      .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
  }

  function ensureDom() {
    if (document.getElementById('evad-msg-modal')) return;
    var w = document.createElement('div');
    w.id = 'evad-msg-modal';
    w.style.cssText = "display:none;position:fixed;inset:0;z-index:100050;font-family:'Satoshi',sans-serif";
    w.innerHTML =
      '<div style="position:absolute;inset:0;background:rgba(13,43,34,.55);backdrop-filter:blur(4px)" onclick="evadCloseChat()"></div>'
    + '<div role="dialog" aria-label="Conversation" style="position:relative;max-width:440px;width:calc(100% - 2rem);margin:6vh auto 0;height:min(78vh,620px);display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.32);overflow:hidden">'
    +   '<div style="display:flex;align-items:center;gap:.7rem;padding:.9rem 1.1rem;border-bottom:1px solid rgba(46,102,66,.1);flex-shrink:0">'
    +     '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--fern),var(--moss));display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">💬</div>'
    +     '<div style="flex:1;min-width:0"><div id="evad-msg-title" style="font-size:.86rem;font-weight:800;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>'
    +       '<div id="evad-msg-sub" style="font-size:.64rem;color:var(--moss);opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div></div>'
    +     '<button onclick="evadCloseChat()" aria-label="Fermer" style="flex-shrink:0;background:none;border:none;font-size:1.2rem;color:var(--moss);opacity:.55;cursor:pointer">✕</button>'
    +   '</div>'
    +   '<div id="evad-msg-list" style="flex:1;min-height:0;overflow-y:auto;padding:1rem 1.1rem;background:rgba(46,102,66,.03);display:flex;flex-direction:column;gap:.5rem"></div>'
    +   '<div style="display:flex;gap:.5rem;padding:.8rem 1rem;border-top:1px solid rgba(46,102,66,.1);flex-shrink:0">'
    +     '<textarea id="evad-msg-input" rows="1" placeholder="Écris ton message…" onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();evadSendChat();}" style="flex:1;resize:none;max-height:90px;padding:.6rem .75rem;border:1px solid rgba(46,102,66,.2);border-radius:12px;font-family:inherit;font-size:.82rem;color:var(--ink);outline:none"></textarea>'
    +     '<button onclick="evadSendChat()" style="flex-shrink:0;align-self:flex-end;background:var(--forest);color:#fff;border:none;border-radius:12px;padding:.6rem .9rem;font-size:.82rem;font-weight:700;cursor:pointer;font-family:inherit">Envoyer</button>'
    +   '</div>'
    + '</div>';
    document.body.appendChild(w);
  }

  function renderList(msgs) {
    var list = document.getElementById('evad-msg-list');
    if (!list) return;
    var me = _state.meta ? _state.meta.me : evadChatMe();
    if (!msgs.length) {
      list.innerHTML = '<div style="margin:auto;text-align:center;color:var(--moss);opacity:.6;font-size:.75rem;padding:1.5rem">Aucun message pour l\'instant.<br>Écris le premier 👇</div>';
      return;
    }
    list.innerHTML = msgs.map(function (m) {
      var mine = m.author_id === me.id;
      var bubble = mine
        ? 'align-self:flex-end;background:var(--forest);color:#fff;border-radius:14px 14px 4px 14px'
        : 'align-self:flex-start;background:#fff;color:var(--ink);border:1px solid rgba(46,102,66,.14);border-radius:14px 14px 14px 4px';
      var meta = mine
        ? '<div style="font-size:.55rem;color:var(--moss);opacity:.55;text-align:right;margin-top:.15rem">' + esc(relTime(m.created_at)) + '</div>'
        : '<div style="font-size:.55rem;color:var(--moss);opacity:.6;margin-top:.15rem">' + esc(m.author_nom || 'Membre') + ' · ' + esc(relTime(m.created_at)) + '</div>';
      return '<div style="max-width:80%;' + (mine ? 'align-self:flex-end' : 'align-self:flex-start') + '">'
        + '<div style="' + bubble + ';padding:.5rem .7rem;font-size:.8rem;line-height:1.45;white-space:pre-wrap;word-break:break-word">' + esc(m.text) + '</div>'
        + meta + '</div>';
    }).join('');
    list.scrollTop = list.scrollHeight;
  }

  function appendOne(m) {
    if (!_state.seen || _state.seen.has(m.id)) return;
    _state.seen.add(m.id);
    _state.msgs = (_state.msgs || []).concat(m);
    renderList(_state.msgs);
  }

  // Ouvre la conversation d'un fil.
  async function evadOpenChat(threadId, opts) {
    opts = opts || {};
    ensureDom();
    evadCloseChatChannel(); // ferme un éventuel abonnement précédent
    var me = evadChatMe();
    _state = { threadId: threadId, chan: null, seen: new Set(), msgs: [], meta: { me: me, opts: opts } };
    var t = document.getElementById('evad-msg-title'); if (t) t.textContent = opts.title || 'Conversation';
    var s = document.getElementById('evad-msg-sub'); if (s) s.textContent = opts.sub || '';
    document.getElementById('evad-msg-modal').style.display = 'block';
    var inp = document.getElementById('evad-msg-input'); if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 80); }

    var msgs = await loadThread(threadId);
    if (_state.threadId !== threadId) return; // l'utilisateur a déjà changé de fil
    _state.msgs = msgs;
    msgs.forEach(function (m) { _state.seen.add(m.id); });
    renderList(msgs);

    // Temps réel (si Supabase Realtime actif).
    if (global.evadSupabase && typeof global.evadSupabase.channel === 'function') {
      try {
        _state.chan = global.evadSupabase.channel('msg:' + threadId)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: 'thread_id=eq.' + threadId },
            function (payload) { if (payload && payload.new) { lsUpsert(payload.new); appendOne(payload.new); } })
          .subscribe();
      } catch (e) {}
    }
  }

  function evadCloseChatChannel() {
    if (_state.chan && global.evadSupabase) { try { global.evadSupabase.removeChannel(_state.chan); } catch (e) {} }
    _state.chan = null;
  }

  function evadCloseChat() {
    evadCloseChatChannel();
    var m = document.getElementById('evad-msg-modal');
    if (m) m.style.display = 'none';
    _state.threadId = null;
  }

  async function evadSendChat() {
    var inp = document.getElementById('evad-msg-input');
    if (!inp || !_state.threadId) return;
    var text = (inp.value || '').trim();
    if (!text) return;
    var me = _state.meta.me, opts = _state.meta.opts || {};
    var row = {
      id: 'msg-' + uuid(), thread_id: _state.threadId,
      quete_id: opts.quete_id || null, lieu_id: opts.lieu_id || null,
      author_id: me.id, author_role: me.role, author_nom: me.nom,
      dest_id: opts.dest_id || null, text: text,
      created_at: new Date().toISOString()
    };
    inp.value = '';
    lsUpsert(row);
    appendOne(row);          // affichage optimiste immédiat
    if (global.evadSupabase) {
      try {
        var r = await global.evadSupabase.from('messages').insert({
          id: row.id, thread_id: row.thread_id, quete_id: row.quete_id, lieu_id: row.lieu_id,
          author_id: row.author_id, author_role: row.author_role, author_nom: row.author_nom,
          dest_id: row.dest_id, text: row.text
        });
        if (r.error && typeof mmBubble === 'function') mmBubble('⚠️ Message affiché ici mais non envoyé : ' + r.error.message);
      } catch (e) {
        if (typeof mmBubble === 'function') mmBubble('⚠️ Message gardé localement (réseau indisponible).');
      }
    }
  }

  global.evadOpenChat = evadOpenChat;
  global.evadCloseChat = evadCloseChat;
  global.evadSendChat = evadSendChat;
  global.evadChatThreadQuete = evadChatThreadQuete;
  global.evadChatMe = evadChatMe;
})(window);
