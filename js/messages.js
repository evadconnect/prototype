/* EVAD · messages.js
   Messagerie interne légère (fils de discussion entre utilisateurs).
   - Backend : table Supabase `messages` + Realtime.
   - Repli : localStorage (fonctionne hors-ligne / avant exécution du SQL),
     sans temps réel mais sans perte de la conversation locale.
   Ouverture : evadOpenChat(threadId, { title, sub, quete_id, lieu_id, dest_id }).

   Identité (voir evadChatMe plus bas) : un membre est TOUJOURS désigné par
   l'id stable de sa fiche Supabase, jamais par son nom. Les appelants
   (evadMsgBtn / evadStartChat) doivent donc passer { id: <id de la fiche> }.
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

  // ── Repère de synchronisation : date du message le plus récent déjà reçu
  //    du serveur. Le rafraîchissement périodique ne redemande que ce qui est
  //    arrivé APRÈS, au lieu de retélécharger toute ma messagerie. ──
  var LS_HW = 'evad:v1:msg-sync';
  function hwGet() { try { return global.localStorage.getItem(LS_HW) || null; } catch (e) { return null; } }
  function hwBump(rows) {
    var max = hwGet();
    rows.forEach(function (m) {
      if (m && m.created_at && (!max || String(m.created_at) > String(max))) max = m.created_at;
    });
    if (max) { try { global.localStorage.setItem(LS_HW, max); } catch (e) {} }
  }
  // Marge de sécurité : un message inséré à T peut n'être visible qu'après
  // notre lecture. On repart 2 min avant le repère pour ne rien manquer.
  function hwSince() {
    var hw = hwGet();
    if (!hw) return null;
    var t = Date.parse(hw);
    if (!t) return null;
    try { return new Date(t - 120000).toISOString(); } catch (e) { return null; }
  }

  // ── Conversations mises en favori : épinglées en haut de la boîte. ──
  // Propre à l'appareil, comme les marqueurs « lu » : il n'y a pas encore de
  // préférences utilisateur côté base.
  var LS_FAV = 'evad:v1:msg-fav';
  function favAll() {
    try { return JSON.parse(global.localStorage.getItem(LS_FAV) || '[]') || []; } catch (e) { return []; }
  }
  function favSet(list) {
    try { global.localStorage.setItem(LS_FAV, JSON.stringify(list.slice(-200))); } catch (e) {}
  }
  function favHas(threadId) { return favAll().indexOf(threadId) >= 0; }
  function favForget(threadId) {
    var l = favAll(), i = l.indexOf(threadId);
    if (i >= 0) { l.splice(i, 1); favSet(l); }
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

  // ── Identité : UN seul format d'identifiant, partagé par les deux côtés ──
  // Règle : un membre est désigné par l'id STABLE de sa fiche (l'uuid
  // Supabase), que cet id soit lu depuis « moi » (evadChatMe) ou depuis la
  // fiche de quelqu'un d'autre (evadMsgBtn / evadStartChat).
  // Avant ce correctif, « moi » valait l'uuid mais les autres m'écrivaient à
  // « bat:<mon nom> » : les deux côtés ne calculaient pas le même thread_id,
  // le destinataire ne voyait jamais le message et son badge restait à zéro.
  //
  // NB : currentRole / myLieuData / batFicheData / semFicheData sont des
  // bindings lexicaux de haut niveau (let dans app-core), PAS des propriétés
  // de window — on les lit par nom nu, pas via global. Un `let` pas encore
  // initialisé fait lever `typeof` (zone morte temporelle), d'où les try.
  function _myRole() { try { return (typeof currentRole !== 'undefined' && currentRole) ? currentRole : 'batisseur'; } catch (e) { return 'batisseur'; } }
  function _myLieu() { try { return (typeof myLieuData !== 'undefined' && myLieuData) ? myLieuData : null; } catch (e) { return null; } }
  function _myBat()  { try { return (typeof batFicheData !== 'undefined' && batFicheData) ? batFicheData : null; } catch (e) { return null; } }
  function _mySem()  { try { return (typeof semFicheData !== 'undefined' && semFicheData) ? semFicheData : null; } catch (e) { return null; } }
  function _lsGet(k) { try { return global.localStorage.getItem(k) || null; } catch (e) { return null; } }

  // Noms génériques : ils désignaient tout le monde à la fois dans l'ancien
  // format « bat:<nom> ». On ne les reprend jamais comme identité, sinon deux
  // inconnus partageraient la même boîte de réception.
  var GENERIC_NAMES = {
    'toi': 1, 'moi': 1, 'membre': 1, 'pilote': 1, 'semeur': 1, 'financeur': 1,
    'batisseur': 1, 'bâtisseur': 1, 'ce lieu': 1, 'lieu': 1, 'conversation': 1,
    "bâtisseur d'impact": 1, 'contact organisation': 1
  };

  // Identifiant d'un interlocuteur : l'id de sa fiche. Repli sur son nom
  // uniquement pour les fiches de démonstration, qui n'ont pas d'id.
  function _peerId(target) {
    target = target || {};
    var id = (target.id == null ? '' : String(target.id)).trim();
    if (id) return id;
    var nom = (target.nom == null ? '' : String(target.nom)).trim();
    return nom ? 'nom:' + nom : '';
  }

  // Tous MES identifiants. Deux raisons d'en avoir plusieurs :
  //  1. je peux tenir plusieurs rôles (pilote d'un lieu ET bâtisseur) : ma
  //     boîte doit tout montrer, quel que soit le rôle actif ;
  //  2. les anciens identifiants par nom sont conservés, sinon les
  //     conversations reçues avant ce correctif resteraient invisibles.
  function evadChatIds(primary) {
    var out = [], seen = {};
    function push(v) {
      v = (v == null ? '' : String(v)).trim();
      if (v && !seen[v]) { seen[v] = 1; out.push(v); }
    }
    function pushLegacy(prefixes, names) {
      names.forEach(function (n) {
        n = (n == null ? '' : String(n)).trim();
        if (!n || GENERIC_NAMES[n.toLowerCase()]) return;
        prefixes.forEach(function (p) { push(p + n); });
      });
    }
    push(primary);
    var lieu = _myLieu(), bat = _myBat(), sem = _mySem();
    if (lieu) { push(lieu.id); pushLegacy(['lieu:', 'user:', 'm:', 'nom:'], [lieu.nom]); }
    if (bat) {
      push(bat.id); push(_lsGet('evad:batisseur-id'));
      pushLegacy(['bat:', 'user:', 'm:', 'nom:'], [bat.prenom, ((bat.prenom || '') + ' ' + (bat.nom || '')).trim()]);
    }
    if (sem) {
      push(sem.id); push(_lsGet('evad:semeur-id'));
      pushLegacy(['sem:', 'user:', 'm:', 'nom:'], [sem.nom]);
    }
    return out;
  }

  // Id de repli quand aucune fiche n'existe encore : stable pour ce
  // navigateur, jamais partagé (l'ancien repli était la chaîne « pilote »,
  // commune à tous les pilotes du prototype).
  function _anonId() {
    var v = _lsGet('evad:chat-anon-id');
    if (!v) { v = 'anon-' + uuid(); try { global.localStorage.setItem('evad:chat-anon-id', v); } catch (e) {} }
    return v;
  }

  // ── Identité de COMPTE, pour le cloisonnement des conversations en base ──
  // evadChatMe() renvoie une identité de FICHE, qui sert à l'affichage et aux
  // fils. La RLS, elle, ne sait raisonner que sur le compte Supabase : on
  // renseigne donc user_id (moi) et dest_user_id (mon correspondant) à chaque
  // envoi. Voir supabase-messages-cloisonnement.sql.
  async function _authUid() {
    try {
      var c = global.evadSupabase; if (!c) return null;
      var d = await c.auth.getSession();
      return (d.data && d.data.session && d.data.session.user && d.data.session.user.id) || null;
    } catch (e) { return null; }
  }

  // Compte propriétaire d'une fiche, à partir de son identifiant. Résultat mis
  // en cache : une conversation envoie plusieurs messages au même destinataire.
  var _uidParFiche = {};
  async function _uidForFiche(ficheId) {
    if (!ficheId) return null;
    if (Object.prototype.hasOwnProperty.call(_uidParFiche, ficheId)) return _uidParFiche[ficheId];
    var uid = null;
    try {
      var c = global.evadSupabase;
      if (c) {
        var tables = ['fiche_pilote', 'fiche_batisseur', 'fiche_semeur'];
        for (var i = 0; i < tables.length && !uid; i++) {
          // Un identifiant hérité (« nom:Camille ») n'est pas un uuid : la
          // requête renvoie une erreur, qu'on ignore pour passer à la suivante.
          var r = await c.from(tables[i]).select('user_id').eq('id', ficheId).limit(1);
          if (!r.error && r.data && r.data.length) uid = r.data[0].user_id || null;
        }
      }
    } catch (e) {}
    _uidParFiche[ficheId] = uid;
    return uid;
  }

  // Identité de l'utilisateur courant (selon son rôle actif).
  function evadChatMe() {
    var role = _myRole(), id = null, nom = null;
    var lieu = _myLieu(), bat = _myBat(), sem = _mySem();
    try {
      if (role === 'pilote') {
        id = (lieu && lieu.id) || null;
        nom = (lieu && lieu.nom) || 'Pilote';
      } else if (role === 'semeur') {
        id = ((typeof _currentSemeurId === 'function') ? _currentSemeurId() : null) || (sem && sem.id) || null;
        nom = (sem && sem.nom) || 'Semeur';
      } else {
        id = ((typeof _currentBatisseurId === 'function') ? _currentBatisseurId() : null) || (bat && bat.id) || null;
        nom = (((bat && bat.prenom) || '') + ' ' + ((bat && bat.nom) || '')).trim() || 'Bâtisseur';
      }
    } catch (e) {}
    if (!id) id = _anonId();
    return { role: role, id: id, nom: nom, ids: evadChatIds(id) };
  }

  // Table de mes identifiants, pour tester « ce message est-il de moi ? ».
  function _mineSet(me) {
    var s = {};
    ((me && me.ids && me.ids.length) ? me.ids : [me && me.id]).forEach(function (i) { if (i) s[i] = 1; });
    return s;
  }

  // Fil déterministe Pilote ↔ Bâtisseur autour d'une quête.
  function evadChatThreadQuete(queteId, batisseurId) {
    return 'q:' + (queteId || 'x') + ':' + (batisseurId || 'x');
  }

  // Fil de discussion directe entre deux membres. Le tri rend la clé
  // identique des deux côtés, à condition que chacun désigne l'autre par le
  // même identifiant : c'est tout l'enjeu de evadChatMe / _peerId ci-dessus.
  function evadChatDmThread(aId, bId) {
    var a = String(aId || 'x'), b = String(bId || 'x');
    return 'dm:' + [a, b].sort().join('|');
  }

  // Retrouve l'interlocuteur à partir de la clé d'un fil direct : des deux
  // moitiés de « dm:<a>|<b> », celle qui n'est pas moi.
  function _dmOther(threadId, mine) {
    if (!threadId || String(threadId).slice(0, 3) !== 'dm:') return null;
    var parts = String(threadId).slice(3).split('|');
    for (var i = 0; i < parts.length; i++) { if (parts[i] && !mine[parts[i]]) return parts[i]; }
    return null;
  }

  // ── Chargement des messages d'un fil : union distant ∪ local. ──
  // On fusionne pour ne jamais perdre un message présent d'un seul côté
  // (ex. message envoyé hors-ligne, ou pas encore propagé par Realtime).
  //
  // Par page : une conversation ancienne peut compter des centaines de
  // messages, dont on n'affiche que la fin. On charge les PAGE derniers, et
  // « Messages plus anciens » remonte l'historique à la demande.
  var PAGE = 50;
  async function loadThread(threadId, before) {
    var byId = {}, hasMore = false;
    if (global.evadSupabase) {
      try {
        var q = global.evadSupabase.from('messages').select('*')
          .eq('thread_id', threadId)
          .order('created_at', { ascending: false })
          .limit(PAGE);
        if (before) q = q.lt('created_at', before);
        var r = await q;
        if (!r.error && Array.isArray(r.data)) {
          hasMore = r.data.length >= PAGE;   // page pleine : il reste probablement de l'historique
          r.data.forEach(function (m) { byId[m.id] = m; lsUpsert(m); });
        }
      } catch (e) {}
    }
    // Messages locaux du fil : envoyés hors-ligne, ou déjà connus de cet appareil.
    lsAll().forEach(function (m) {
      if (m.thread_id !== threadId || byId[m.id]) return;
      if (before && String(m.created_at) >= String(before)) return;
      byId[m.id] = m;
    });
    var rows = Object.keys(byId).map(function (k) { return byId[k]; })
      .sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
    return { msgs: rows, hasMore: hasMore };
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
    +     '<button id="evad-msg-fav" onclick="evadToggleFav()" style="flex-shrink:0;background:none;border:none;font-size:1rem;cursor:pointer;padding:0 .2rem;line-height:1"></button>'
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

  function renderList(msgs, opts) {
    var list = document.getElementById('evad-msg-list');
    if (!list) return;
    var me = _state.meta ? _state.meta.me : evadChatMe();
    var mine = _mineSet(me);
    if (!msgs.length) {
      list.innerHTML = '<div style="margin:auto;text-align:center;color:var(--moss);opacity:.6;font-size:.75rem;padding:1.5rem">Aucun message pour l\'instant.<br>Écris le premier 👇</div>';
      return;
    }
    // Remonter l'historique ajoute des messages EN HAUT : on garde l'ancrage
    // visuel plutôt que de sauter en bas de la conversation.
    var keepScroll = !!(opts && opts.keepScroll);
    var beforeH = list.scrollHeight, beforeTop = list.scrollTop;
    var older = _state.hasMore
      ? '<button onclick="evadLoadOlder()" ' + (_state.loading ? 'disabled ' : '')
        + 'style="align-self:center;flex-shrink:0;margin-bottom:.4rem;background:#fff;border:1px solid rgba(46,102,66,.2);color:var(--moss);border-radius:100px;padding:.35rem .8rem;font-size:.68rem;font-weight:700;cursor:pointer;font-family:inherit">'
        + (_state.loading ? 'Chargement…' : '↑ Messages plus anciens') + '</button>'
      : '';
    list.innerHTML = older + msgs.map(function (m) {
      var isMine = !!mine[m.author_id];
      var bubble = isMine
        ? 'align-self:flex-end;background:var(--forest);color:#fff;border-radius:14px 14px 4px 14px'
        : 'align-self:flex-start;background:#fff;color:var(--ink);border:1px solid rgba(46,102,66,.14);border-radius:14px 14px 14px 4px';
      var meta = isMine
        ? '<div style="font-size:.55rem;color:var(--moss);opacity:.55;text-align:right;margin-top:.15rem">' + esc(relTime(m.created_at)) + '</div>'
        : '<div style="font-size:.55rem;color:var(--moss);opacity:.6;margin-top:.15rem">' + esc(m.author_nom || 'Membre') + ' · ' + esc(relTime(m.created_at)) + '</div>';
      return '<div style="max-width:80%;' + (isMine ? 'align-self:flex-end' : 'align-self:flex-start') + '">'
        + '<div style="' + bubble + ';padding:.5rem .7rem;font-size:.8rem;line-height:1.45;white-space:pre-wrap;word-break:break-word">' + esc(m.text) + '</div>'
        + meta + '</div>';
    }).join('');
    list.scrollTop = keepScroll ? (beforeTop + list.scrollHeight - beforeH) : list.scrollHeight;
  }

  // Remonte d'une page dans l'historique du fil ouvert.
  async function evadLoadOlder() {
    if (!_state.threadId || _state.loading || !_state.msgs || !_state.msgs.length) return;
    var tid = _state.threadId, oldest = _state.msgs[0].created_at;
    if (!oldest) return;
    _state.loading = true;
    renderList(_state.msgs, { keepScroll: true });
    var page = await loadThread(tid, oldest);
    if (_state.threadId !== tid) return;          // l'utilisateur a changé de fil
    var add = page.msgs.filter(function (m) { return !_state.seen.has(m.id); });
    add.forEach(function (m) { _state.seen.add(m.id); });
    seenMark(add.map(function (m) { return m.id; }));
    _state.msgs = add.concat(_state.msgs);
    _state.hasMore = page.hasMore;
    _state.loading = false;
    renderList(_state.msgs, { keepScroll: true });
  }

  function appendOne(m) {
    if (!_state.seen || _state.seen.has(m.id)) return;
    _state.seen.add(m.id);
    _state.msgs = (_state.msgs || []).concat(m);
    seenMark([m.id]);            // le fil est ouvert : message vu
    evadRefreshUnread({ delta: true });
    renderList(_state.msgs);
  }

  // Ouvre la conversation d'un fil.
  async function evadOpenChat(threadId, opts) {
    opts = opts || {};
    ensureDom();
    evadCloseChatChannel(); // ferme un éventuel abonnement précédent
    var me = evadChatMe();
    _state = { threadId: threadId, chan: null, seen: new Set(), msgs: [], hasMore: false, loading: false, meta: { me: me, opts: opts } };
    threadRegister(threadId, opts);           // mémorise l'interlocuteur pour l'inbox
    var t = document.getElementById('evad-msg-title'); if (t) t.textContent = opts.title || 'Conversation';
    var s = document.getElementById('evad-msg-sub'); if (s) s.textContent = opts.sub || '';
    var back = document.getElementById('evad-msg-back'); if (back) back.style.display = opts.fromInbox ? 'block' : 'none';
    _syncFavBtn();
    var inbox = document.getElementById('evad-inbox-modal'); if (inbox) inbox.style.display = 'none';
    document.getElementById('evad-msg-modal').style.display = 'block';
    var inp = document.getElementById('evad-msg-input'); if (inp) { inp.value = ''; setTimeout(function () { inp.focus(); }, 80); }

    var page = await loadThread(threadId);
    if (_state.threadId !== threadId) return; // l'utilisateur a déjà changé de fil
    var msgs = page.msgs;
    _state.msgs = msgs;
    _state.hasMore = page.hasMore;
    msgs.forEach(function (m) { _state.seen.add(m.id); });
    seenMark(msgs.map(function (m) { return m.id; }));   // marque le fil comme lu
    evadRefreshUnread({ delta: true });
    renderList(msgs);

    // Temps réel (si Supabase Realtime actif). Ce filtre-ci porte sur le fil,
    // donc il conviendra tel quel à une conversation de groupe.
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

  // ── Favori : épingle la conversation en haut de la boîte de réception. ──
  // Sans argument : le fil actuellement ouvert.
  function evadToggleFav(threadId) {
    threadId = threadId || _state.threadId;
    if (!threadId) return;
    var list = favAll(), i = list.indexOf(threadId);
    if (i >= 0) list.splice(i, 1); else list.push(threadId);
    favSet(list);
    _syncFavBtn();
    if (typeof mmBubble === 'function') mmBubble(i >= 0 ? '☆ Retiré des favoris' : '⭐ Conversation mise en favori');
    // Boîte ouverte derrière : on la retrie tout de suite.
    var inbox = document.getElementById('evad-inbox-modal');
    if (inbox && inbox.style.display === 'block') evadOpenInbox();
  }

  // Reflète l'état favori sur l'étoile de l'en-tête du fil ouvert.
  function _syncFavBtn() {
    var b = document.getElementById('evad-msg-fav');
    if (!b) return;
    var on = _state.threadId ? favHas(_state.threadId) : false;
    b.textContent = on ? '⭐' : '☆';
    b.style.opacity = on ? '1' : '.5';
    var label = on ? 'Retirer des favoris' : 'Mettre en favori';
    b.setAttribute('aria-label', label);
    b.setAttribute('title', label);
  }

  // Supprime une conversation entière : messages (Supabase + localStorage),
  // registre du fil, favori et marqueurs « vu ». Par défaut le fil ouvert.
  async function evadDeleteThread(threadId) {
    threadId = threadId || _state.threadId;
    if (!threadId) return;
    if (!global.confirm('Supprimer cette conversation ? Cette action est définitive.')) return;
    favForget(threadId);
    // localStorage D'ABORD : garanti même si Supabase est lent/bloqué/refusé (RLS).
    try {
      var kept = lsAll().filter(function (m) { return m.thread_id !== threadId; });
      global.localStorage.setItem(LS_KEY, JSON.stringify(kept));
    } catch (e) {}
    // Registre du fil (titre/interlocuteur).
    try {
      var all = threadsAll(); if (all[threadId]) { delete all[threadId]; global.localStorage.setItem(LS_THREADS, JSON.stringify(all)); }
    } catch (e) {}
    // Supabase (best effort, non bloquant : on ne fait pas attendre l'UI).
    if (global.evadSupabase) {
      try { global.evadSupabase.from('messages').delete().eq('thread_id', threadId); } catch (e) {}
    }
    evadCloseChat();
    if (typeof evadRefreshUnread === 'function') { try { evadRefreshUnread(); } catch (e) {} }
    // Rouvre la boîte de réception si elle était derrière.
    if (typeof evadOpenInbox === 'function') { try { evadOpenInbox(); } catch (e) {} }
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
        var envoi = {
          id: row.id, thread_id: row.thread_id, quete_id: row.quete_id, lieu_id: row.lieu_id,
          author_id: row.author_id, author_role: row.author_role, author_nom: row.author_nom,
          dest_id: row.dest_id, text: row.text
        };
        // Comptes des deux participants, pour que la base sache qui a le droit
        // de lire ce message. Résolus après l'affichage optimiste : le message
        // apparaît sans attendre ces deux requêtes.
        envoi.user_id = await _authUid();
        envoi.dest_user_id = await _uidForFiche(row.dest_id);
        var r = await global.evadSupabase.from('messages').insert(envoi);
        // Repli si les colonnes n'existent pas encore en base (script SQL pas
        // encore passé sur cet environnement) : on renvoie sans elles plutôt
        // que de perdre le message.
        if (r.error && /user_id/.test(r.error.message || '')) {
          delete envoi.user_id; delete envoi.dest_user_id;
          r = await global.evadSupabase.from('messages').insert(envoi);
        }
        if (r.error && typeof mmBubble === 'function') mmBubble('⚠️ Message affiché ici mais non envoyé : ' + r.error.message);
      } catch (e) {
        if (typeof mmBubble === 'function') mmBubble('⚠️ Message gardé localement (réseau indisponible).');
      }
    }
  }

  function roleLabel(r) {
    return r === 'pilote' ? 'Pilote' : r === 'semeur' ? 'Semeur' : r === 'batisseur' ? 'Bâtisseur' : (r || 'Membre');
  }

  // Bouton « Envoyer un message » réutilisable sur toutes les fiches.
  // target : { id, nom, role, lieu_id }. La cible est passée en JSON via un
  // attribut data- (robuste aux apostrophes/guillemets dans les noms).
  function evadMsgBtn(target, opts) {
    opts = opts || {};
    // Pas de bouton sur ma propre fiche : on ne s'écrit pas à soi-même.
    if (_mineSet(evadChatMe())[_peerId(target)]) return '';
    var attr = JSON.stringify(target || {}).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var style = 'background:' + (opts.bg || 'var(--forest)') + ';color:#fff;margin-top:' + (opts.mt || '.5rem');
    return '<button class="acteur-cta" style="' + style + '" data-evadmsg="' + attr + '" '
      + 'onclick="evadStartChat(JSON.parse(this.getAttribute(\'data-evadmsg\')))">✉️ '
      + (opts.label || 'Envoyer un message') + '</button>';
  }

  // ── Tous les messages où je suis impliqué (auteur OU destinataire). ──
  // opts.delta : ne demander que les messages arrivés depuis la dernière
  // synchronisation (le cas courant, appelé toutes les N secondes). Sans
  // l'option, on resynchronise tout : à l'ouverture de la boîte et au
  // démarrage, pour reconstituer le cache local.
  async function _myMessages(opts) {
    opts = opts || {};
    var me = evadChatMe(), mine = _mineSet(me);
    var ids = Object.keys(mine);
    var byId = {};
    if (global.evadSupabase && ids.length) {
      // Deux requêtes `in` plutôt qu'un `or` : les anciens identifiants
      // contiennent des noms (espaces, apostrophes, virgules) qui casseraient
      // la syntaxe d'un filtre `or` construit à la main.
      var since = opts.delta ? hwSince() : null;
      try {
        var res = await Promise.all(['author_id', 'dest_id'].map(function (col) {
          var q = global.evadSupabase.from('messages').select('*').in(col, ids);
          return since ? q.gt('created_at', since) : q;
        }));
        var fresh = [];
        res.forEach(function (r) {
          if (!r.error && Array.isArray(r.data)) r.data.forEach(function (m) { byId[m.id] = m; lsUpsert(m); fresh.push(m); });
        });
        // Le repère n'avance que sur des lignes venues du serveur : un message
        // écrit hors-ligne porte l'heure du navigateur, qui peut être en avance.
        hwBump(fresh);
      } catch (e) {}
    }
    // Complète / repli avec le local (et fournit tout l'historique en mode delta).
    lsAll().forEach(function (m) {
      if (!byId[m.id] && (mine[m.author_id] || mine[m.dest_id])) byId[m.id] = m;
    });
    return { me: me, mine: mine, msgs: Object.keys(byId).map(function (k) { return byId[k]; }) };
  }

  // Regroupe mes messages par fil → une ligne d'inbox par conversation.
  async function evadLoadInbox(opts) {
    var data = await _myMessages(opts), me = data.me, mine = data.mine;
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
      var unread = t.msgs.filter(function (m) { return mine[m.dest_id] && !mine[m.author_id] && !seenSet[m.id]; }).length;
      // Nom de l'interlocuteur : dernier auteur ≠ moi, sinon le registre, sinon générique.
      var otherMsg = null;
      for (var i = t.msgs.length - 1; i >= 0; i--) { if (!mine[t.msgs[i].author_id]) { otherMsg = t.msgs[i]; break; } }
      var r = reg[tid] || {};
      var title = (otherMsg && otherMsg.author_nom) || r.title || 'Conversation';
      var oRole = (otherMsg && otherMsg.author_role) || r.otherRole || null;
      // L'id de l'interlocuteur, dans l'ordre : le dernier message reçu, le
      // destinataire d'un message que j'ai envoyé, le registre local, enfin la
      // clé du fil elle-même (dm:<a>|<b>) — ce dernier repli permet de
      // répondre depuis un autre appareil, sans registre en localStorage.
      var oId = (otherMsg && otherMsg.author_id) || null;
      if (!oId) {
        for (var j = t.msgs.length - 1; j >= 0; j--) {
          if (mine[t.msgs[j].author_id] && t.msgs[j].dest_id && !mine[t.msgs[j].dest_id]) { oId = t.msgs[j].dest_id; break; }
        }
      }
      if (!oId) oId = r.otherId || _dmOther(tid, mine) || null;
      var prefix = mine[last.author_id] ? 'Toi : ' : '';
      return {
        threadId: tid, title: title, otherId: oId, otherRole: oRole,
        quete_id: last.quete_id || r.quete_id || null, lieu_id: last.lieu_id || r.lieu_id || null,
        snippet: prefix + (last.text || ''), when: last.created_at, unread: unread,
        fav: favHas(tid)
      };
    });
    // Favoris en tête, puis du plus récent au plus ancien.
    rows.sort(function (a, b) {
      if (a.fav !== b.fav) return a.fav ? -1 : 1;
      return String(b.when).localeCompare(String(a.when));
    });
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
    +   '<div style="flex-shrink:0;padding:.7rem .9rem;border-top:1px solid rgba(46,102,66,.1);background:#fff">'
    +     '<button onclick="evadCloseInbox();if(window.openAmelioration)openAmelioration()" style="width:100%;display:flex;align-items:center;justify-content:center;gap:.4rem;background:rgba(200,115,42,.08);border:1px solid rgba(200,115,42,.25);color:var(--amber);border-radius:12px;padding:.6rem;font-size:.75rem;font-weight:700;cursor:pointer;font-family:inherit">💡 Proposer une amélioration</button>'
    +     '<button onclick="evadClearLocalChats()" title="Efface les conversations stockées sur cet appareil (n\'affecte pas les autres membres)" style="width:100%;background:none;border:none;color:var(--moss);opacity:.55;font-size:.65rem;cursor:pointer;font-family:inherit;margin-top:.45rem;text-decoration:underline">🧹 Vider mes conversations locales</button>'
    +   '</div>'
    + '</div>';
    document.body.appendChild(w);
  }

  function renderInbox(rows) {
    var list = document.getElementById('evad-inbox-list');
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<div style="margin:2rem auto;text-align:center;color:var(--moss);opacity:.65;font-size:.78rem;padding:1.5rem;line-height:1.5">Aucune conversation pour l\'instant.<br>Contacte un lieu ou un bâtisseur depuis la carte avec le bouton « Envoyer un message » 💬</div>';
      return;
    }
    list.innerHTML = rows.map(function (row) {
      var av = row.title ? row.title.trim().charAt(0).toUpperCase() : '💬';
      var badge = row.unread
        ? '<span style="flex-shrink:0;min-width:18px;height:18px;padding:0 5px;border-radius:100px;background:#f07030;color:#fff;font-size:.6rem;font-weight:800;display:flex;align-items:center;justify-content:center">' + row.unread + '</span>'
        : '';
      var chip = row.otherRole ? '<span style="font-size:.56rem;color:var(--moss);opacity:.7;background:rgba(46,102,66,.08);border-radius:100px;padding:.05rem .4rem;flex-shrink:0">' + esc(roleLabel(row.otherRole)) + '</span>' : '';
      // L'identifiant du fil passe par un attribut data- : il peut contenir le
      // nom de l'interlocuteur (apostrophes, espaces) et casserait un onclick
      // construit par concaténation de chaînes.
      var tid = esc(row.threadId);
      var act = 'flex-shrink:0;background:none;border:none;cursor:pointer;padding:.25rem;line-height:1;font-size:.95rem;border-radius:8px';
      var actions =
          '<button data-tid="' + tid + '" onclick="event.stopPropagation();evadToggleFav(this.getAttribute(\'data-tid\'))" '
        +   'aria-label="' + (row.fav ? 'Retirer des favoris' : 'Mettre en favori') + '" title="' + (row.fav ? 'Retirer des favoris' : 'Mettre en favori') + '" '
        +   'style="' + act + ';opacity:' + (row.fav ? '1' : '.45') + '">' + (row.fav ? '⭐' : '☆') + '</button>'
        + '<button data-tid="' + tid + '" onclick="event.stopPropagation();evadDeleteThread(this.getAttribute(\'data-tid\'))" '
        +   'aria-label="Supprimer la conversation" title="Supprimer la conversation" '
        +   'style="' + act + ';opacity:.4;color:var(--moss)">🗑</button>';
      return '<div data-tid="' + tid + '" onclick="evadInboxOpen(this.getAttribute(\'data-tid\'))" style="display:flex;align-items:center;gap:.6rem;padding:.7rem .5rem .7rem .8rem;border-radius:12px;cursor:pointer;transition:background .12s' + (row.fav ? ';background:rgba(240,176,50,.07)' : '') + '" onmouseover="this.style.background=\'rgba(46,102,66,.06)\'" onmouseout="this.style.background=\'' + (row.fav ? 'rgba(240,176,50,.07)' : 'transparent') + '\'">'
        + '<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--fern),var(--moss));color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:800;flex-shrink:0">' + esc(av) + '</div>'
        + '<div style="flex:1;min-width:0">'
        +   '<div style="display:flex;align-items:center;gap:.4rem"><span style="font-size:.82rem;font-weight:' + (row.unread ? '800' : '600') + ';color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(row.title) + '</span>' + chip + '</div>'
        +   '<div style="font-size:.68rem;color:var(--moss);opacity:' + (row.unread ? '.9' : '.6') + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem">' + esc(row.snippet) + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:.15rem;flex-shrink:0">'
        +   '<span style="font-size:.55rem;color:var(--moss);opacity:.55">' + esc(relTime(row.when)) + '</span>'
        +   '<div style="display:flex;align-items:center;gap:.1rem">' + badge + actions + '</div>'
        + '</div>'
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
    // Ouverture manuelle : resynchronisation complète, c'est le moment où
    // l'utilisateur attend une liste juste (et le cache local se reconstitue).
    var rows = await evadLoadInbox();
    _inboxRows = {}; rows.forEach(function (r) { _inboxRows[r.threadId] = r; });
    _inboxSig = rows.map(function (r) { return r.threadId + '|' + r.when + '|' + r.unread + '|' + (r.fav ? 1 : 0); }).join('#');
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
    var otherId = _peerId(target);
    if (!otherId) {
      if (typeof mmBubble === 'function') mmBubble('Cette fiche n\'a pas encore de contact joignable 🍃');
      return;
    }
    if (_mineSet(me)[otherId]) {
      if (typeof mmBubble === 'function') mmBubble('C\'est ta propre fiche 🙂');
      return;
    }
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
  var _unread = 0, _inboxSig = '';
  async function evadRefreshUnread(opts) {
    try {
      var data = await _myMessages(opts), mine = data.mine;
      var seenSet = {}; seenAll().forEach(function (i) { seenSet[i] = 1; });
      _unread = data.msgs.filter(function (m) { return mine[m.dest_id] && !mine[m.author_id] && !seenSet[m.id]; }).length;
    } catch (e) { _unread = _unread || 0; }
    var b = document.getElementById('evad-msg-unread-badge');
    if (b) {
      b.textContent = _unread > 99 ? '99+' : String(_unread);
      b.style.display = _unread > 0 ? 'flex' : 'none';
    }
    // Si l'inbox est ouverte, on la rafraîchit pour refléter l'état. On ne
    // redessine que si quelque chose a bougé : sinon un rafraîchissement
    // périodique reconstruisait la liste entière sans rien changer, et
    // interrompait le défilement de l'utilisateur.
    var inbox = document.getElementById('evad-inbox-modal');
    if (inbox && inbox.style.display === 'block') {
      var rows = await evadLoadInbox(opts);
      var sig = rows.map(function (r) { return r.threadId + '|' + r.when + '|' + r.unread + '|' + (r.fav ? 1 : 0); }).join('#');
      if (sig !== _inboxSig) {
        _inboxSig = sig;
        _inboxRows = {}; rows.forEach(function (r) { _inboxRows[r.threadId] = r; });
        renderInbox(rows);
      }
    }
    return _unread;
  }

  // ── Init : abonnement temps réel global + rafraîchissement périodique. ──
  var _inboxChans = [], _inboxKey = '';
  function evadMessagesInit() {
    try { evadRefreshUnread(); } catch (e) {}
    if (!global.evadSupabase || typeof global.evadSupabase.channel !== 'function') { _startUnreadTimer(); return; }
    // Temps réel : tout nouveau message me concernant met à jour le badge.
    // Un abonnement par identifiant (je peux être pilote ET bâtisseur) ; les
    // filtres PostgREST n'acceptent pas d'espaces, donc les anciens
    // identifiants par nom sont couverts par le rafraîchissement périodique.
    //
    // Limite connue : ce filtre porte sur dest_id, c'est-à-dire un
    // destinataire unique. Une conversation de groupe (fil de lieu) n'aura pas
    // de dest_id ; il faudra alors s'abonner sur thread_id, ce qui suppose de
    // savoir à quels fils j'appartiens — à traiter avec le fil de lieu.
    var me = evadChatMe();
    var ids = (me.ids || [me.id]).filter(function (i) { return /^[A-Za-z0-9:_-]+$/.test(i); }).slice(0, 4);
    var key = ids.join('|');
    if (key && key !== _inboxKey) {
      _inboxChans.forEach(function (c) { try { global.evadSupabase.removeChannel(c); } catch (e) {} });
      _inboxChans = [];
      ids.forEach(function (id) {
        try {
          _inboxChans.push(global.evadSupabase.channel('inbox:' + id)
            .on('postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'messages', filter: 'dest_id=eq.' + id },
              function (payload) { if (payload && payload.new) { lsUpsert(payload.new); evadRefreshUnread({ delta: true }); } })
            .subscribe());
        } catch (e) {}
      });
      _inboxKey = key;
      _stopUnreadTimer();   // la cadence change quand le temps réel est actif
    }
    _startUnreadTimer();
  }

  // ── Rafraîchissement périodique : uniquement un filet de sécurité. ──
  // Quand Realtime fonctionne, il prévient déjà des nouveaux messages : le
  // timer sert alors de repli lent. Il ne tourne pas quand l'onglet est
  // masqué, et ne demande que le delta (voir hwSince).
  function _startUnreadTimer() {
    if (global._evadUnreadTimer || document.hidden) return;
    var delay = _inboxChans.length ? 60000 : 20000;
    global._evadUnreadTimer = setInterval(function () { try { evadRefreshUnread({ delta: true }); } catch (e) {} }, delay);
  }
  function _stopUnreadTimer() {
    if (global._evadUnreadTimer) { clearInterval(global._evadUnreadTimer); global._evadUnreadTimer = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { _stopUnreadTimer(); return; }
    try { evadRefreshUnread({ delta: true }); } catch (e) {}
    _startUnreadTimer();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(evadMessagesInit, 400); });
  else setTimeout(evadMessagesInit, 400);

  // Mon identité n'existe qu'une fois les fiches reçues de Supabase : au
  // premier passage, evadChatMe() n'a encore aucun id de fiche et le badge se
  // calculerait sur une identité vide. On rejoue donc l'init à l'hydratation.
  ['evad:supabase-ready', 'evad:batisseurs-ready', 'evad:semeurs-ready'].forEach(function (ev) {
    global.addEventListener(ev, function () { setTimeout(evadMessagesInit, 150); });
  });

  // Réinitialise toutes les conversations stockées SUR CET APPAREIL (localStorage).
  // N'affecte ni la base Supabase ni les autres membres : utile pour repartir
  // propre après une phase de test.
  function evadClearLocalChats() {
    if (!global.confirm('Vider toutes tes conversations locales sur cet appareil ?\n(N\'affecte pas les autres membres.)')) return;
    ['evad:v1:messages', 'evad:v1:threads', 'evad:v1:msg-seen', 'evad:v1:msg-fav', 'evad:v1:msg-sync']
      .forEach(function (k) { try { global.localStorage.removeItem(k); } catch (e) {} });
    if (typeof evadRefreshUnread === 'function') { try { evadRefreshUnread(); } catch (e) {} }
    if (typeof evadOpenInbox === 'function') { try { evadOpenInbox(); } catch (e) {} }
  }

  global.evadOpenChat = evadOpenChat;
  global.evadCloseChat = evadCloseChat;
  global.evadDeleteThread = evadDeleteThread;
  global.evadClearLocalChats = evadClearLocalChats;
  global.evadToggleFav = evadToggleFav;
  global.evadSendChat = evadSendChat;
  global.evadLoadOlder = evadLoadOlder;
  global.evadChatThreadQuete = evadChatThreadQuete;
  global.evadChatDmThread = evadChatDmThread;
  global.evadChatMe = evadChatMe;
  global.evadChatIds = evadChatIds;
  global.evadChatPeerId = _peerId;
  global.evadOpenInbox = evadOpenInbox;
  global.evadCloseInbox = evadCloseInbox;
  global.evadInboxOpen = evadInboxOpen;
  global.evadStartChat = evadStartChat;
  global.evadRefreshUnread = evadRefreshUnread;
  global.evadMsgBtn = evadMsgBtn;
})(window);
