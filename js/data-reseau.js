const RESEAU_PROFILS = {
  pilote:    {label:'Pilote',    color:'#2e6b47', bg:'rgba(46,107,71,.12)',  ic:'🏡'},
  batisseur: {label:'Bâtisseur', color:'#a06c00', bg:'rgba(240,176,50,.18)', ic:'🌿'},
  semeur:    {label:'Semeur',    color:'#2563a8', bg:'rgba(59,130,180,.14)', ic:'🌱'},
};
const VADE_PHASES = {
  valoriser:  {label:'Valoriser',  letter:'V', color:'#018262'},
  activer:    {label:'Activer',    letter:'A', color:'#2d6a9f'},
  developper: {label:'Développer', letter:'D', color:'#c8732a'},
  elever:     {label:'Élever',     letter:'E', color:'#6b5b95'},
};
const RESEAU_POSTS = [];

/* ── Synchronisation Supabase ──────────────────────────────────────────────
   Le fil du Réseau est stocké dans la table `reseau_posts`. On utilise le
   client global `window.evadSupabase` (initialisé dans supabase-config.js,
   chargé plus bas dans la page), d'où l'attente de DOMContentLoaded avant
   la première hydratation. ── */
const RESEAU_BUCKET = 'reseau';

// Calcule un texte relatif simple ("à l'instant", "il y a 3 h"...) à partir
// d'une date ISO issue de Supabase (created_at).
function reseauRelTime(iso){
  if(!iso) return 'à l\'instant';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if(min < 1) return 'à l\'instant';
  if(min < 60) return 'il y a ' + min + ' min';
  const h = Math.floor(min / 60);
  if(h < 24) return 'il y a ' + h + ' h';
  const j = Math.floor(h / 24);
  return 'il y a ' + j + ' j';
}

// Convertit une ligne Supabase (table reseau_posts) vers le format post utilisé par renderReseau().
function _reseauRowToPost(row){
  return {
    id: row.id,
    profile: row.profile,
    author: row.author,
    author_id: row.author_id || null,
    lieu: row.lieu,
    time: reseauRelTime(row.created_at),
    type: row.type,
    regen: row.regen,
    text: row.text,
    cta: row.cta,
    quest: row.quest || null,
    img: row.img || null
  };
}

// Id de fiche de l'auteur d'un post : c'est lui qui sert à ouvrir la
// conversation. Les posts publiés avant l'ajout de la colonne author_id n'en
// ont pas : on retrouve alors la fiche par son nom dans le store.
function _reseauAuthorId(p){
  if(p.author_id) return p.author_id;
  const nom = (p.author || '').trim();
  if(!nom || !window.store) return null;
  try {
    if(p.profile === 'batisseur'){
      const m = store.all('batisseurs').find(r =>
        ((r.prenom || '') + ' ' + (r.nom || '')).trim() === nom || (r.prenom || '').trim() === nom);
      return m ? m.id : null;
    }
    if(p.profile === 'semeur'){
      const m = store.all('semeurs').find(r => (r.nom || '').trim() === nom);
      return m ? m.id : null;
    }
    const m = store.all('lieux').find(r => (r.nom || '').trim() === nom);
    return m ? m.id : null;
  } catch(e){ return null; }
}

// Insertion d'un post, tolérante à la colonne author_id manquante (tant que
// supabase-reseau-author-id.sql n'a pas été exécuté sur le projet).
async function _reseauInsertPost(row){
  let r = await window.evadSupabase.from('reseau_posts').insert(row).select().single();
  if(r.error && row.author_id && /author_id/.test(r.error.message || '')){
    const fallback = Object.assign({}, row);
    delete fallback.author_id;
    r = await window.evadSupabase.from('reseau_posts').insert(fallback).select().single();
  }
  return r;
}

// Charge les posts existants depuis Supabase et remplace le fil local.
async function reseauHydrateRemote(){
  if(!window.evadSupabase) return;
  try {
    const { data, error } = await window.evadSupabase
      .from('reseau_posts')
      .select('*')
      .order('created_at', { ascending: false });
    if(error){ console.error('Erreur lecture reseau_posts :', error.message); return; }
    RESEAU_POSTS.length = 0;
    (data || []).forEach(row => RESEAU_POSTS.push(_reseauRowToPost(row)));
    renderReseau();
  } catch(e){
    console.error('Erreur réseau Supabase (reseau_posts) :', e);
  }
}
document.addEventListener('DOMContentLoaded', reseauHydrateRemote);

// Réseau simplifié : un seul fil d'action (les « cercles de parole » ont été retirés).
function reseauTab(t, btn){
  const fil = document.getElementById('reseau-view-fil');
  if (fil) fil.style.display = 'block';
}
let reseauFilter = 'tout';
let reseauRegenFilter = 'tout';
let reseauProx = false;
const RESEAU_NEAR = ['Bordeaux', 'Bègles', 'Talence', 'Cenon']; // "près de moi" (métropole de Bordeaux)
function reseauSetFilter(f, btn){
  reseauFilter = f;
  document.querySelectorAll('.reseau-filter').forEach(b=>{ b.style.background='white'; b.style.color='var(--moss)'; });
  if(btn){ btn.style.background='var(--forest)'; btn.style.color='white'; }
  renderReseau();
}
function reseauRenderRegenFilters(){
  const box = document.getElementById('reseau-rfilters');
  if(!box) return;
  const mk = (key, label, color) => {
    const on = reseauRegenFilter === key;
    const c = color || 'var(--forest)';
    return `<button onclick="reseauSetRegenFilter('${key}')" style="border:1px solid ${on?c:'rgba(46,102,66,.2)'};background:${on?c:'white'};color:${on?'white':(color||'var(--moss)')};border-radius:100px;padding:.3rem .7rem;font-size:.66rem;font-weight:700;cursor:pointer">${label}</button>`;
  };
  box.innerHTML = `<span style="font-size:.6rem;font-weight:700;color:var(--moss);opacity:.5;text-transform:uppercase;letter-spacing:.08em;margin-right:.1rem">Phase VADE</span>`
    + mk('tout', 'Toutes', null)
    + Object.entries(VADE_PHASES).map(([k,v]) => mk(k, v.label, v.color)).join('');
}
function reseauSetRegenFilter(r){
  reseauRegenFilter = r;
  reseauRenderRegenFilters();
  renderReseau();
}
function reseauToggleProx(btn){
  reseauProx = !reseauProx;
  if(btn){ btn.style.background = reseauProx?'var(--forest)':'white'; btn.style.color = reseauProx?'white':'var(--moss)'; }
  renderReseau();
}

/* ─── Composer : formulaires quête / rencontre ─── */
const RF_INP = "width:100%;border:1px solid rgba(46,102,66,.18);background:rgba(46,102,66,.04);border-radius:8px;padding:.55rem .7rem;font-size:.76rem;color:var(--ink);outline:none;font-family:inherit;margin-bottom:.5rem;box-sizing:border-box;";
let reseauFormType = 'quete';
let reseauFormRegen = 'activer';
let reseauFormImg = '';   // aperçu local (base64), affiché uniquement dans le formulaire
let reseauFormFile = null; // fichier brut, uploadé vers Storage à la publication
function reseauFormPhoto(input){
  const file = input.files[0];
  if(!file) return;
  reseauFormFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    reseauFormImg = e.target.result;
    const prev = document.getElementById('rf-photo-preview');
    if(prev) prev.innerHTML = `<div style="position:relative;display:inline-block;margin-top:.5rem">
      <img src="${reseauFormImg}" style="height:80px;border-radius:10px;display:block;object-fit:cover">
      <button type="button" onclick="reseauRemovePhoto()" style="position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:50%;background:var(--ink);color:white;border:none;cursor:pointer;font-size:.7rem;line-height:1">✕</button>
    </div>`;
  };
  reader.readAsDataURL(file);
}
function reseauRemovePhoto(){
  reseauFormImg = '';
  reseauFormFile = null;
  const prev = document.getElementById('rf-photo-preview');
  if(prev) prev.innerHTML = '';
}

// Upload de la photo du post vers le bucket Storage `reseau`, renvoie l'URL publique.
async function _reseauUploadPhoto(file){
  const safe = (file.name || 'image').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-50);
  const path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
  const { error } = await window.evadSupabase.storage.from(RESEAU_BUCKET).upload(path, file);
  if(error) throw error;
  const { data } = window.evadSupabase.storage.from(RESEAU_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
function reseauRegenChips(){
  return Object.entries(VADE_PHASES).map(([k,v])=>{
    const on = k===reseauFormRegen;
    return `<button type="button" onclick="reseauFormRegen='${k}';reseauRefreshChips()" style="border:1px solid ${on?v.color:'rgba(46,102,66,.2)'};background:${on?v.color:'white'};color:${on?'white':v.color};border-radius:100px;padding:.25rem .6rem;font-size:.66rem;font-weight:700;cursor:pointer">${v.label}</button>`;
  }).join('');
}
function reseauRefreshChips(){
  const c = document.getElementById('rf-regen');
  if(c) c.innerHTML = reseauRegenChips();
}
function reseauOpenForm(type){
  reseauFormType = type;
  reseauFormRegen = type==='quete' ? 'activer' : 'elever';
  reseauFormImg = '';
  reseauFormFile = null;
  const isQuete = type==='quete';
  const box = document.getElementById('reseau-form');
  box.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.7rem">
      <div style="font-size:.82rem;font-weight:800;color:var(--ink)">${isQuete?'⚡ Mettre à jour une quête':'🤝 Proposer une rencontre'}</div>
      <button type="button" onclick="reseauCloseForm()" style="background:none;border:none;cursor:pointer;color:var(--moss);font-size:.95rem">✕</button>
    </div>
    <input id="rf-titre" placeholder="${isQuete?'Titre de la quête':'Sujet de la rencontre'}" style="${RF_INP}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
      <input id="rf-lieu" placeholder="📍 Lieu" style="${RF_INP}">
      <input id="rf-detail" placeholder="${isQuete?'⏱ Durée · places (ex : 1 j · 4 pers.)':'🗓 Quand ? (ex : sam. 14h)'}" style="${RF_INP}">
    </div>
    <textarea id="rf-message" placeholder="Ton message…" style="${RF_INP}min-height:70px;resize:none"></textarea>
    <div style="margin-bottom:.7rem">
      <label style="display:inline-flex;align-items:center;gap:.4rem;cursor:pointer;font-size:.72rem;font-weight:600;color:var(--forest);padding:.4rem .8rem;border:1px solid rgba(46,102,66,.3);border-radius:100px;background:rgba(46,102,66,.06)">
        📷 Ajouter une photo
        <input type="file" accept="image/*" style="display:none" onchange="reseauFormPhoto(this)">
      </label>
      <div id="rf-photo-preview"></div>
    </div>
    <div style="font-size:.6rem;font-weight:700;color:var(--moss);opacity:.6;text-transform:uppercase;letter-spacing:.1em;margin:.1rem 0 .4rem">Phase VADE</div>
    <div id="rf-regen" style="display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:.8rem">${reseauRegenChips()}</div>
    <div style="display:flex;gap:.6rem;justify-content:flex-end">
      <button type="button" onclick="reseauCloseForm()" style="background:none;border:1px solid rgba(46,102,66,.2);color:var(--moss);border-radius:100px;padding:.5rem 1rem;font-size:.74rem;font-weight:700;cursor:pointer">Annuler</button>
      <button type="button" onclick="reseauPublish()" style="background:var(--forest);color:white;border:none;border-radius:100px;padding:.5rem 1.3rem;font-size:.74rem;font-weight:700;cursor:pointer">Publier</button>
    </div>`;
  box.style.display = 'block';
}
function reseauCloseForm(){
  const box = document.getElementById('reseau-form');
  if(box){ box.style.display='none'; box.innerHTML=''; }
}
async function reseauPublish(){
  const v = id => (document.getElementById(id)?.value || '').trim();
  const titre = v('rf-titre'), lieu = v('rf-lieu'), detail = v('rf-detail'), message = v('rf-message');
  if(!titre && !message){ mmBubble('✍️ Ajoute au moins un titre ou un message'); return; }
  const role = (typeof currentRole !== 'undefined' && currentRole) ? currentRole : 'pilote';
  const isQuete = reseauFormType === 'quete';
  // Auteur réel : sans lui, tous les posts s'affichaient « Toi » et le bouton
  // « Échanger » ouvrait la même conversation pour toute la communauté.
  const meChat = (typeof evadChatMe === 'function') ? evadChatMe() : null;
  const post = {
    profile: role,
    author: (meChat && meChat.nom) || 'Toi',
    author_id: (meChat && meChat.id) || null,
    lieu: lieu || '-', time: 'à l\'instant',
    type: isQuete ? 'quete' : 'rencontre', regen: reseauFormRegen,
    text: message || titre,
    cta: isQuete ? 'Rejoindre la quête' : 'Proposer un créneau',
  };
  if(isQuete && (titre || detail)) post.quest = { titre: titre || 'Quête', meta: detail || 'à préciser' };
  if(!isQuete){
    let t = (titre && message && titre !== message) ? (titre + ', ' + message) : (message || titre);
    if(detail) t += ' 🗓 ' + detail;
    post.text = t;
  }
  if(reseauFormImg) post.img = reseauFormImg; // aperçu optimiste, remplacé par l'URL Storage une fois envoyé

  // Affichage optimiste immédiat, avant même la réponse de Supabase.
  RESEAU_POSTS.unshift(post);
  reseauCloseForm();
  reseauSetFilter('tout', document.querySelector('.reseau-filter[data-f="tout"]'));
  mmBubble(isQuete ? '⚡ Quête publiée sur le Réseau !' : '🤝 Rencontre proposée sur le Réseau !');

  // Sauvegarde réelle dans Supabase.
  if(!window.evadSupabase){ console.error("Supabase n'est pas initialisé, post gardé localement seulement."); return; }
  try {
    let imgUrl = null;
    if(reseauFormFile){
      try { imgUrl = await _reseauUploadPhoto(reseauFormFile); }
      catch(e){ console.error('Upload photo réseau échoué :', e); } // on continue sans image plutôt que bloquer le post
    }
    const row = {
      profile: post.profile, author: post.author, author_id: post.author_id || null, lieu: post.lieu,
      type: post.type, regen: post.regen, text: post.text, cta: post.cta,
      quest: post.quest || null, img: imgUrl
    };
    const { data, error } = await _reseauInsertPost(row);
    if(error) throw error;
    // Remplace le post optimiste par la version confirmée (id réel + image définitive).
    const idx = RESEAU_POSTS.indexOf(post);
    if(idx !== -1) RESEAU_POSTS[idx] = _reseauRowToPost(data);
    renderReseau();
  } catch(e){
    console.error('Erreur sauvegarde reseau_posts :', e);
    mmBubble('⚠️ Ton post est affiché ici mais n\'a pas pu être enregistré définitivement, réessaie plus tard.');
  }
}
// Persiste un post construit ailleurs (publication d'une quête depuis la
// fiche quête ou le tableau de bord) dans reseau_posts : sans ça, le post
// n'existait qu'en mémoire et disparaissait au rechargement.
async function reseauPersistPost(post){
  if(!window.evadSupabase) return;
  try {
    const row = {
      profile: post.profile, author: post.author, author_id: post.author_id || null, lieu: post.lieu,
      type: post.type, regen: post.regen, text: post.text, cta: post.cta,
      quest: post.quest || null, img: post.img || null
    };
    const { data, error } = await _reseauInsertPost(row);
    if(error) throw error;
    // Remplace la version optimiste par la ligne confirmée (id + horodatage réels).
    const idx = RESEAU_POSTS.indexOf(post);
    if(idx !== -1) RESEAU_POSTS[idx] = _reseauRowToPost(data);
    renderReseau();
  } catch(e){
    console.error('Erreur sauvegarde reseau_posts :', e);
    if(typeof mmBubble === 'function') mmBubble('⚠️ Post affiché ici mais non enregistré sur le réseau, réessaie plus tard');
  }
}

// Ouvre la VRAIE fiche de la quête depuis un post du fil (fini le simple toast).
function reseauJoinQuete(qid, titre){
  if (typeof batBuildQuetesFromProfile === 'function') batBuildQuetesFromProfile();
  const list = (typeof BAT_QUETES !== 'undefined') ? BAT_QUETES : [];
  let i = qid ? list.findIndex(q => q.srcId === qid) : -1;
  if (i < 0 && titre) i = list.findIndex(q => q.titre === titre && q.statut === 'ouverte');
  if (i >= 0 && typeof showQueteDetail === 'function') { showQueteDetail(i, 'reseau'); return; }
  if (typeof mmBubble === 'function') mmBubble('Cette quête n\'est plus ouverte 🍃');
}

function renderReseau(){
  const feed = document.getElementById('reseau-feed');
  if(!feed) return;
  const posts = RESEAU_POSTS.filter(p =>
    (reseauFilter==='tout' || p.type===reseauFilter) &&
    (reseauRegenFilter==='tout' || p.regen===reseauRegenFilter) &&
    (!reseauProx || RESEAU_NEAR.includes(p.lieu))
  );
  // Mes identifiants : sert à ne pas proposer « Échanger » sur mes propres posts.
  const myIds = (typeof evadChatMe === 'function') ? (evadChatMe().ids || []) : [];
  const rq = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const typeChip = t => t==='quete'
    ? '<span style="font-size:.62rem;font-weight:700;color:#a06c00;background:rgba(240,176,50,.16);border-radius:100px;padding:.18rem .55rem">⚡ Quête</span>'
    : '<span style="font-size:.62rem;font-weight:700;color:#2563a8;background:rgba(59,130,180,.14);border-radius:100px;padding:.18rem .55rem">🤝 Rencontre</span>';
  feed.innerHTML = posts.map(p=>{
    const pr = RESEAU_PROFILS[p.profile];
    const authorId = _reseauAuthorId(p);
    const authorIsMe = authorId && myIds.indexOf(authorId) >= 0;
    const questCard = p.quest ? `
      <div style="border:1px solid rgba(240,176,50,.3);background:rgba(240,176,50,.06);border-radius:12px;padding:.7rem .85rem;margin:.7rem 0;display:flex;align-items:center;gap:.7rem">
        <div style="font-size:1.3rem">⚡</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.76rem;font-weight:700;color:var(--ink)">${p.quest.titre}</div>
          <div style="font-size:.64rem;color:var(--moss);opacity:.7;margin-top:.1rem">${p.quest.meta}</div>
        </div>
      </div>` : '';
    const isPhoto = p.img && (p.img.startsWith('data:') || p.img.startsWith('http'));
    const imgCard = p.img ? (isPhoto
      ? `<img src="${p.img}" alt="" style="width:100%;max-height:240px;object-fit:cover;border-radius:12px;margin:.7rem 0;display:block">`
      : `<div style="height:120px;border-radius:12px;background:linear-gradient(135deg,rgba(46,107,71,.12),rgba(126,201,176,.18));display:flex;align-items:center;justify-content:center;font-size:2.4rem;margin:.7rem 0">${p.img}</div>`) : '';
    const matchBox = '';
    const rg = VADE_PHASES[p.regen];
    const regenPastille = rg ? `
      <span style="display:inline-flex;align-items:center;gap:.35rem;font-size:.6rem;font-weight:700;color:${rg.color};background:${rg.color}14;border:1px solid ${rg.color}33;border-radius:100px;padding:.2rem .55rem .2rem .25rem">
        <span style="width:15px;height:15px;border-radius:50%;background:${rg.color};color:white;display:inline-flex;align-items:center;justify-content:center;font-size:.52rem;font-weight:900">${rg.letter}</span>${rg.label}
      </span>` : '';
    return `
    <div style="background:white;border:1px solid rgba(46,102,66,.1);border-radius:16px;padding:1.05rem 1.15rem;margin-bottom:.9rem">
      <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.6rem">
        <div style="width:42px;height:42px;border-radius:50%;background:${pr.bg};display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0">${pr.ic}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:.45rem;flex-wrap:wrap">
            <span style="font-size:.82rem;font-weight:800;color:var(--ink)">${p.author}</span>
            <span style="font-size:.58rem;font-weight:700;color:${pr.color};background:${pr.bg};border-radius:100px;padding:.12rem .5rem">${pr.label}</span>
          </div>
          <div style="font-size:.64rem;color:var(--moss);opacity:.6;margin-top:.1rem">📍 ${p.lieu} · ${p.time}</div>
        </div>
        ${typeChip(p.type)}
      </div>
      <div style="margin-bottom:.5rem">${regenPastille}</div>
      <div style="font-size:.8rem;color:var(--ink);line-height:1.5">${p.text}</div>
      ${questCard}${imgCard}${matchBox}
      <div style="display:flex;align-items:center;gap:.6rem;margin-top:.8rem;padding-top:.7rem;border-top:1px solid rgba(46,102,66,.08)">
        ${authorIsMe ? '' : `<button onclick="evadStartChat({id:'${rq(authorId)}',nom:'${rq(p.author)}',role:'${rq(p.profile)}'})" style="background:white;border:1px solid rgba(46,102,66,.25);color:var(--forest);border-radius:100px;padding:.4rem .9rem;font-size:.72rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem">💬 Échanger</button>`}
        <button onclick="evadGoLieu('${(p.author||'').replace(/'/g,"\\'")}','${(p.lieu||'').replace(/'/g,"\\'")}')" style="background:white;border:1px solid rgba(46,102,66,.25);color:var(--forest);border-radius:100px;padding:.4rem .9rem;font-size:.72rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem">🗺 Voir le lieu</button>
        <button onclick="${p.type === 'quete' && p.quest
          ? `reseauJoinQuete('${String(p.quest.id || '').replace(/'/g, "\\'")}','${String(p.quest.titre || '').replace(/'/g, "\\'")}')`
          : `mmBubble('${p.cta}, ${p.author}')`}" style="margin-left:auto;background:${pr.bg};color:${pr.color};border:none;border-radius:100px;padding:.4rem .9rem;font-size:.72rem;font-weight:700;cursor:pointer">${p.cta} →</button>
      </div>
    </div>`;
  }).join('');

  if(posts.length === 0){
    feed.innerHTML = `<div style="text-align:center;padding:2.5rem 1rem;color:var(--moss);opacity:.6">
      <div style="font-size:1.8rem;margin-bottom:.4rem">🍃</div>
      <div style="font-size:.78rem;font-weight:600">Aucun post pour ces filtres</div>
      <div style="font-size:.66rem;opacity:.8;margin-top:.2rem">Élargis les filtres pour découvrir d'autres quêtes et rencontres.</div>
    </div>`;
    return;
  }
  // Fil fini, pas de scroll infini
  feed.innerHTML += `<div style="text-align:center;padding:1.6rem 1rem .5rem;color:var(--moss)">
    <div style="font-size:1.5rem;margin-bottom:.3rem">🌿</div>
    <div style="font-size:.76rem;font-weight:700;color:var(--forest)">Tu es à jour</div>
    <div style="font-size:.65rem;opacity:.65;margin-top:.2rem">Pas de défilement sans fin ici, reviens quand tu veux passer à l'action.</div>
  </div>`;
}
reseauRenderRegenFilters();
renderReseau();
