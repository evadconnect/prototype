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

  // ── Registre des fils : mémorise l'interlocuteur d'un fil (nom/rôle) pour
  //    afficher l'inbox même quand l'autre n'a pas encore répondu. ──
  var LS_THREADS = 'evad:v1:threads';
  function threadsAll() {
    try { return JSON.parse(global.localStorage.getItem(LS_THREADS) || '{}') || {}; } catch (e) { return {}; }
  }
  function threadRegister(threadId, opts) {
    if (!threadId) return;
    try {
      var all = threadsAll();
      var cur = all[threadId] || {};
      all[threadId] = {
        title: (opts && opts.title) || cur.title || 'Conversation',
        sub:   (opts && opts.sub)   || cur.sub   || '',
        otherId:   (opts && opts.dest_id)    || cur.otherId   || null,
        otherRole: (opts && opts.dest_role)  || cur.otherRole || null,
        quete_id:  (opts && opts.quete_id)   || cur.quete_id  || null,
        lieu_id:   (opts && opts.lieu_id)    || cur.lieu_id   || null
      };
      global.localStorage.setItem(LS_THREADS, JSON.stringify(all));
    } catch (e) {}
  }

  // ── Suivi des messages lus (par id) pour le compteur de non-lus. ──
  var LS_SEEN = 'evad:v1:msg-seen';
  function seenAll() {
    try { return JSON.parse(global.localStorage.getItem(LS_SEEN) || '[]') || []; } catch (e) { return []; }
  }
  function seenMark(ids) {
    if (!ids || !ids.length) return;
    try {
      var set = {}; seenAll().forEach(function (i) { set[i] = 1; });
      var changed = false;
      ids.forEach(function (i) { if (i && !set[i]) { set[i] = 1; changed = true; } });
      if (changed) global.localStorage.setItem(LS_SEEN, JSON.stringify(Object.keys(set).slice(-2000)));
    } catch (e) {}
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

  // Fil de discussion directe entre deux membres (indépendant de qui l'ouvre).
  function evadChatDmThread(aId, bId) {
    var a = String(aId || 'x'), b = String(bId || 'x');
    return 'dm:' + [a, b].sort().join('|');
  }

  // ── Chargement des messages d'un fil : union distant ∪ local. ──
  // On fusionne pour ne jamais perdre un message présent d'un seul côté
  // (ex. message envoyé hors-ligne, ou pas encore propagé par Realtime).
  async function loadThread(threadId) {
    var byId = {};
    if (global.evadSupabase) {
      try {
        var r = await global.evadSupabase.from('messages').select('*')
          .eq('thread_id', threadId).order('created_at', { ascending: true });
        if (!r.error && Array.isArray(r.data)) r.data.forEach(function (m) { byId[m.id] = m; lsUpsert(m); });
      } catch (e) {}
    }
    lsAll().forEach(function (m) { if (m.thread_id === threadId && !byId[m.id]) byId[m.id] = m; });
    return Object.keys(byId).map(function (k) { return byId[k]; })
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
    +     '<button id="evad-msg-back" onclick="evadOpenInbox()" aria-label="Retour aux messages" title="Retour aux messages" style="display:none;flex-shrink:0;background:none;border:none;font-size:1.2rem;color:var(--moss);cursor:pointer;padding:0 .1rem;line-height:1">‹</button>'
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
    seenMark([m.id]);            // le fil est ouvert : message vu
    evadRefreshUnread();
    renderList(_state.msgs);
  }

  // Ouvre la conversation d'un fil.
  async function evadOpenChat(threadId, opts) {
    opts = opts || {};
    ensureDom();
    evadCloseChatChannel(); // ferme un éventuel abonnement précédent
    var me = evadChatMe();
    _state = { threadId: threadId, chan: null, seen: new Set(), msgs: [], meta: { me: me, opts: opts } };
    threadRegister(threadId, opts);           // mémorise l'interlocuteur pour l'inbox
    var t = document.getElementById('evad-msg-title'); if (t) t.textContent = opts.title || 'Conversation';
    var s = document.getElementById('evad-msg-sub'); if (s) s.textContent = opts.sub || '';
    var back = document.getElementById('evad-msg-back'); if (back) back.style.display = opts.fromInbox ? 'block' : 'none';
    var inbox = document.getElementById('evad-inbox-modal'); if (inbox) inbox.style.display = 'none';
    document.getElementById('evad-msg-modal').style.display = 'block';
    var inp = document.getElementById('evad-msg-input'); if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 80); }

    var msgs = await loadThread(threadId);
    if (_state.threadId !== threadId) return; // l'utilisateur a déjà changé de fil
    _state.msgs = msgs;
    msgs.forEach(function (m) { _state.seen.add(m.id); });
    seenMark(msgs.map(function (m) { return m.id; }));   // marque le fil comme lu
    evadRefreshUnread();
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

  function roleLabel(r) {
    return r === 'pilote' ? 'Pilote' : r === 'semeur' ? 'Semeur' : r === 'batisseur' ? 'Bâtisseur' : (r || 'Membre');
  }

  // ── Tous les messages où je suis impliqué (auteur OU destinataire). ──
  async function _myMessages() {
    var me = evadChatMe();
    var byId = {};
    if (global.evadSupabase) {
      try {
        var r = await global.evadSupabase.from('messages').select('*')
          .or('author_id.eq.' + me.id + ',dest_id.eq.' + me.id)
          .order('created_at', { ascending: true });
        if (!r.error && Array.isArray(r.data)) r.data.forEach(function (m) { byId[m.id] = m; lsUpsert(m); });
      } catch (e) {}
    }
    // Complète / repli avec le local.
    lsAll().forEach(function (m) {
      if (!byId[m.id] && (m.author_id === me.id || m.dest_id === me.id)) byId[m.id] = m;
    });
    return { me: me, msgs: Object.keys(byId).map(function (k) { return byId[k]; }) };
  }

  // Regroupe mes messages par fil → une ligne d'inbox par conversation.
  async function evadLoadInbox() {
    var data = await _myMessages(), me = data.me;
    var seenSet = {}; seenAll().forEach(function (i) { seenSet[i] = 1; });
    var reg = threadsAll();
    var threads = {};
    data.msgs.forEach(function (m) {
      var tid = m.thread_id; if (!tid) return;
      var t = threads[tid] || (threads[tid] = { threadId: tid, msgs: [], unread: 0 });
      t.msgs.push(m);
    });
    var rows = Object.keys(threads).map(function (tid) {
      var t = threads[tid];
      t.msgs.sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
      var last = t.msgs[t.msgs.length - 1];
      var unread = t.msgs.filter(function (m) { return m.dest_id === me.id && !seenSet[m.id]; }).length;
      // Nom de l'interlocuteur : dernier auteur ≠ moi, sinon le registre, sinon générique.
      var otherMsg = null;
      for (var i = t.msgs.length - 1; i >= 0; i--) { if (t.msgs[i].author_id !== me.id) { otherMsg = t.msgs[i]; break; } }
      var r = reg[tid] || {};
      var title = (otherMsg && otherMsg.author_nom) || r.title || 'Conversation';
      var oRole = (otherMsg && otherMsg.author_role) || r.otherRole || null;
      var oId = (otherMsg && otherMsg.author_id) || r.otherId || null;
      var prefix = last.author_id === me.id ? 'Toi : ' : '';
      return {
        threadId: tid, title: title, otherId: oId, otherRole: oRole,
        quete_id: last.quete_id || r.quete_id || null, lieu_id: last.lieu_id || r.lieu_id || null,
        snippet: prefix + (last.text || ''), when: last.created_at, unread: unread
      };
    });
    rows.sort(function (a, b) { return String(b.when).localeCompare(String(a.when)); });
    return rows;
  }

  function ensureInboxDom() {
    if (document.getElementById('evad-inbox-modal')) return;
    var w = document.createElement('div');
    w.id = 'evad-inbox-modal';
    w.style.cssText = "display:none;position:fixed;inset:0;z-index:100050;font-family:'Satoshi',sans-serif";
    w.innerHTML =
      '<div style="position:absolute;inset:0;background:rgba(13,43,34,.55);backdrop-filter:blur(4px)" onclick="evadCloseInbox()"></div>'
    + '<div role="dialog" aria-label="Messages" style="position:relative;max-width:440px;width:calc(100% - 2rem);margin:6vh auto 0;height:min(78vh,620px);display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.32);overflow:hidden">'
    +   '<div style="display:flex;align-items:center;gap:.7rem;padding:.9rem 1.1rem;border-bottom:1px solid rgba(46,102,66,.1);flex-shrink:0">'
    +     '<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--fern),var(--moss));display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">💬</div>'
    +     '<div style="flex:1;min-width:0"><div style="font-size:.86rem;font-weight:800;color:var(--ink)">Messages</div>'
    +       '<div style="font-size:.64rem;color:var(--moss);opacity:.7">Tes conversations</div></div>'
    +     '<button onclick="evadCloseInbox()" aria-label="Fermer" style="flex-shrink:0;background:none;border:none;font-size:1.2rem;color:var(--moss);opacity:.55;cursor:pointer">✕</button>'
    +   '</div>'
    +   '<div id="evad-inbox-list" style="flex:1;min-height:0;overflow-y:auto;padding:.5rem;background:rgba(46,102,66,.03)"></div>'
    + '</div>';
    document.body.appendChild(w);
  }

  function renderInbox(rows) {
    var list = document.getElementById('evad-inbox-list');
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<div style="margin:2rem auto;text-align:center;color:var(--moss);opacity:.65;font-size:.78rem;padding:1.5rem;line-height:1.5">Aucune conversation pour l\'instant.<br>Contacte un lieu ou un bâtisseur depuis le réseau pour démarrer 💬</div>';
      return;
    }
    list.innerHTML = rows.map(function (row) {
      var av = row.title ? row.title.trim().charAt(0).toUpperCase() : '💬';
      var badge = row.unread
        ? '<span style="flex-shrink:0;min-width:18px;height:18px;padding:0 5px;border-radius:100px;background:#f07030;color:#fff;font-size:.6rem;font-weight:800;display:flex;align-items:center;justify-content:center">' + row.unread + '</span>'
        : '';
      var chip = row.otherRole ? '<span style="font-size:.56rem;color:var(--moss);opacity:.7;background:rgba(46,102,66,.08);border-radius:100px;padding:.05rem .4rem;flex-shrink:0">' + esc(roleLabel(row.otherRole)) + '</span>' : '';
      return '<div onclick="evadInboxOpen(\'' + esc(row.threadId).replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:.7rem;padding:.7rem .8rem;border-radius:12px;cursor:pointer;transition:background .12s" onmouseover="this.style.background=\'rgba(46,102,66,.06)\'" onmouseout="this.style.background=\'transparent\'">'
        + '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--fern),var(--moss));color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:800;flex-shrink:0">' + esc(av) + '</div>'
        + '<div style="flex:1;min-width:0">'
        +   '<div style="display:flex;align-items:center;gap:.4rem"><span style="font-size:.82rem;font-weight:' + (row.unread ? '800' : '600') + ';color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(row.title) + '</span>' + chip + '</div>'
        +   '<div style="font-size:.68rem;color:var(--moss);opacity:' + (row.unread ? '.9' : '.6') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem">' + esc(row.snippet) + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:.25rem;flex-shrink:0"><span style="font-size:.55rem;color:var(--moss);opacity:.55">' + esc(relTime(row.when)) + '</span>' + badge + '</div>'
        + '</div>';
    }).join('');
  }

  // Cache le threadId → ligne, pour rouvrir le fil avec ses métadonnées.
  var _inboxRows = {};
  async function evadOpenInbox() {
    ensureInboxDom();
    evadCloseChatChannel();
    var m = document.getElementById('evad-msg-modal'); if (m) m.style.display = 'none';
    document.getElementById('evad-inbox-modal').style.display = 'block';
    var list = document.getElementById('evad-inbox-list');
    if (list) list.innerHTML = '<div style="margin:2rem auto;text-align:center;color:var(--moss);opacity:.6;font-size:.75rem">Chargement…</div>';
    var rows = await evadLoadInbox();
    _inboxRows = {}; rows.forEach(function (r) { _inboxRows[r.threadId] = r; });
    renderInbox(rows);
  }
  function evadCloseInbox() {
    var m = document.getElementById('evad-inbox-modal'); if (m) m.style.display = 'none';
  }
  function evadInboxOpen(threadId) {
    var r = _inboxRows[threadId] || {};
    evadOpenChat(threadId, {
      title: r.title || 'Conversation',
      sub: r.otherRole ? roleLabel(r.otherRole) : '',
      dest_id: r.otherId || null, dest_role: r.otherRole || null,
      quete_id: r.quete_id || null, lieu_id: r.lieu_id || null,
      fromInbox: true
    });
  }

  // Démarre (ou rouvre) une conversation directe avec un membre.
  // target : { id, nom, role, lieu_id }.
  function evadStartChat(target) {
    target = target || {};
    var me = evadChatMe();
    var otherId = target.id || ('m:' + (target.nom || 'membre'));
    var tid = evadChatDmThread(me.id, otherId);
    var opts = {
      title: target.nom || 'Conversation',
      sub: roleLabel(target.role),
      dest_id: otherId, dest_role: target.role || null,
      lieu_id: target.lieu_id || null, fromInbox: false
    };
    threadRegister(tid, opts);
    evadOpenChat(tid, opts);
  }

  // ── Compteur de non-lus (messages qui me sont adressés et non vus). ──
  var _unread = 0;
  async function evadRefreshUnread() {
    try {
      var data = await _myMessages(), me = data.me;
      var seenSet = {}; seenAll().forEach(function (i) { seenSet[i] = 1; });
      _unread = data.msgs.filter(function (m) { return m.dest_id === me.id && m.author_id !== me.id && !seenSet[m.id]; }).length;
    } catch (e) { _unread = _unread || 0; }
    var b = document.getElementById('evad-msg-unread-badge');
    if (b) {
      b.textContent = _unread > 99 ? '99+' : String(_unread);
      b.style.display = _unread > 0 ? 'flex' : 'none';
    }
    // Si l'inbox est ouverte, on la rafraîchit pour refléter l'état.
    var inbox = document.getElementById('evad-inbox-modal');
    if (inbox && inbox.style.display === 'block') {
      var rows = await evadLoadInbox();
      _inboxRows = {}; rows.forEach(function (r) { _inboxRows[r.threadId] = r; });
      renderInbox(rows);
    }
    return _unread;
  }

  // ── Init : abonnement temps réel global + rafraîchissement périodique. ──
  var _inboxChan = null;
  function evadMessagesInit() {
    try { evadRefreshUnread(); } catch (e) {}
    // Temps réel : tout nouveau message me concernant met à jour le badge.
    if (!_inboxChan && global.evadSupabase && typeof global.evadSupabase.channel === 'function') {
      try {
        var me = evadChatMe();
        _inboxChan = global.evadSupabase.channel('inbox:' + me.id)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: 'dest_id=eq.' + me.id },
            function (payload) { if (payload && payload.new) { lsUpsert(payload.new); evadRefreshUnread(); } })
          .subscribe();
      } catch (e) {}
    }
    // Repli si Realtime indisponible : on recalcule régulièrement.
    if (!global._evadUnreadTimer) {
      global._evadUnreadTimer = setInterval(function () { try { evadRefreshUnread(); } catch (e) {} }, 20000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(evadMessagesInit, 400); });
  else setTimeout(evadMessagesInit, 400);

  global.evadOpenChat = evadOpenChat;
  global.evadCloseChat = evadCloseChat;
  global.evadSendChat = evadSendChat;
  global.evadChatThreadQuete = evadChatThreadQuete;
  global.evadChatDmThread = evadChatDmThread;
  global.evadChatMe = evadChatMe;
  global.evadOpenInbox = evadOpenInbox;
  global.evadCloseInbox = evadCloseInbox;
  global.evadInboxOpen = evadInboxOpen;
  global.evadStartChat = evadStartChat;
  global.evadRefreshUnread = evadRefreshUnread;
})(window);
