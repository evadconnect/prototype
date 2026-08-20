
/* ═══════════════════════════════════════════════════════
   QUÊTES × PERMA-COMPTABILITÉ
   ═══════════════════════════════════════════════════════ */

/* Quêtes du Pilote : générées à partir des solutions de la fiche lieu créée */
const PILOTE_QUETES_DEMO = [];

/* État des quêtes validées (session) */
const quetesValidees = new Set();

/* Filtre actif de la liste des quêtes Pilote : toutes | a_publier | ouvertes | terminees | a_traiter */
let piloteQueteFilter = 'toutes';
/* Vue de suivi : liste (groupée par espace) | agenda (triée par date de rencontre) */
let piloteQueteView = 'liste';
/* Id de la quête en cours d'édition dans le formulaire (null = création). */
let pqCreerEditId = null;

/* ─── Modal de présentation d'une quête (depuis la solution source) ─── */
function openQueteModal(qid) {
  const q = (typeof PILOTE_QUETES_DEMO !== 'undefined') ? PILOTE_QUETES_DEMO.find(x => x.id === qid) : null;
  if (!q) return;
  const sol = (typeof SOLS !== 'undefined') ? SOLS.find(s => s.nom === q.source) : null;
  const CPLX = { facile:'🟢 Facile', moyen:'🟠 Intermédiaire', difficile:'🔴 Avancé', avance:'🔴 Avancé' };
  const ic = q.sourceIc || (sol && sol.img) || '⚡';

  let w = document.getElementById('quete-modal');
  if (!w) {
    w = document.createElement('div');
    w.id = 'quete-modal';
    w.style.cssText = "display:none;position:fixed;inset:0;z-index:100000;font-family:'Satoshi',sans-serif";
    document.body.appendChild(w);
  }

  const stat = (val, lbl, col) => `<div style="background:white;border:1px solid rgba(46,102,66,.1);border-radius:12px;padding:.6rem .7rem;text-align:center">
      <div style="font-family:'Satoshi',sans-serif;font-size:1rem;font-weight:800;color:${col||'var(--ink)'}">${val}</div>
      <div style="font-size:.56rem;color:var(--moss);opacity:.65;text-transform:uppercase;letter-spacing:.06em;margin-top:.15rem">${lbl}</div>
    </div>`;

  const avantages = (sol && sol.avantages || []).map(a =>
    `<li style="display:flex;gap:.5rem;align-items:flex-start;font-size:.74rem;color:var(--ink);line-height:1.5;margin-bottom:.35rem"><span style="color:var(--fern);flex-shrink:0">✓</span><span>${a}</span></li>`).join('');
  const indics = (sol && sol.ind || []).map(i =>
    `<span style="padding:.2rem .55rem;border-radius:100px;background:rgba(46,102,66,.07);border:1px solid rgba(46,102,66,.15);font-size:.62rem;color:var(--moss)">📊 ${i}</span>`).join('');
  const esrs = (sol && sol.esrs || []).map(e =>
    `<span style="padding:.2rem .5rem;border-radius:4px;background:rgba(122,110,168,.1);border:1px solid rgba(122,110,168,.3);font-size:.6rem;color:#7a6ea8;font-weight:600;font-family:monospace">${e}</span>`).join('');

  w.innerHTML =
    '<div style="position:absolute;inset:0;background:rgba(13,43,34,.6);backdrop-filter:blur(4px)" onclick="closeQueteModal()"></div>'
  + '<div role="dialog" style="position:relative;max-width:540px;width:calc(100% - 2rem);margin:5vh auto 0;max-height:88vh;overflow-y:auto;background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,.32)">'
  +   (sol && sol.photo ? `<div style="height:150px;background:url('${sol.photo}') center/cover;border-radius:20px 20px 0 0;position:relative"><button onclick="closeQueteModal()" style="position:absolute;top:.7rem;right:.7rem;background:rgba(0,0,0,.45);border:none;color:#fff;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:.85rem">✕</button></div>`
        : '<div style="display:flex;justify-content:flex-end;padding:.6rem .6rem 0"><button onclick="closeQueteModal()" style="background:none;border:none;font-size:1.2rem;color:var(--moss);opacity:.5;cursor:pointer">✕</button></div>')
  +   '<div style="padding:1.1rem 1.4rem 1.5rem">'
  +     `<div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.2rem">
            <div style="width:46px;height:46px;border-radius:14px;background:rgba(240,176,50,.15);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${ic}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:.6rem;font-weight:700;color:#a06c00;text-transform:uppercase;letter-spacing:.08em">⚡ Quête${sol?' · '+sol.nom:''}</div>
              <div style="font-size:1.1rem;font-weight:800;color:var(--ink);line-height:1.2">${q.titre}</div>
            </div>
          </div>`
  +     `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin:1rem 0">
            ${stat('⏱ '+q.duree,'Durée')}
            ${stat('👥 '+q.nb,'Équipe')}
            ${stat(q.graines+' 🌱','Graines','var(--amber)')}
            ${stat((sol?CPLX[sol.cplx]||'-':'-'),'Niveau')}
          </div>`
  +     (q.impact ? `<div style="background:rgba(74,140,92,.08);border:1px solid rgba(74,140,92,.2);border-radius:10px;padding:.55rem .75rem;font-size:.74rem;color:var(--forest);font-weight:600;margin-bottom:.9rem">📈 Impact : ${q.impact}</div>` : '')
  +     (sol && sol.desc ? `<div style="font-size:.55rem;font-weight:700;color:var(--moss);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.3rem">La solution</div><p style="font-size:.78rem;color:var(--ink);line-height:1.6;margin-bottom:1rem">${sol.desc}</p>` : '')
  +     (avantages ? `<div style="font-size:.55rem;font-weight:700;color:var(--moss);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem">Bénéfices</div><ul style="list-style:none;margin:0 0 1rem;padding:0">${avantages}</ul>` : '')
  +     (sol && sol.budget ? `<div style="display:flex;align-items:center;gap:.5rem;font-size:.74rem;color:var(--ink);margin-bottom:1rem"><span style="font-weight:700;color:var(--moss)">💶 Budget indicatif :</span> ${sol.budget}</div>` : '')
  +     (indics ? `<div style="font-size:.55rem;font-weight:700;color:var(--moss);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem">Indicateurs à suivre</div><div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:1rem">${indics}</div>` : '')
  +     (esrs ? `<div style="font-size:.55rem;font-weight:700;color:var(--moss);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.4rem">Référentiels ESRS</div><div style="display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:.4rem">${esrs}</div>${sol && sol.esrs_detail ? `<div style="font-size:.66rem;color:var(--moss);opacity:.8;line-height:1.5;margin-bottom:1rem">${sol.esrs_detail}</div>` : ''}` : '')
  +     `<div style="display:flex;gap:.5rem;margin-top:.6rem;flex-wrap:wrap">
            <button onclick="closeQueteModal()" style="background:none;border:1px solid rgba(46,102,66,.25);color:var(--moss);border-radius:100px;padding:.55rem 1rem;font-size:.78rem;font-weight:700;cursor:pointer">Fermer</button>
            <button onclick="publishQueteToReseau('${q.id}')" style="flex:1;min-width:130px;background:rgba(240,176,50,.14);color:#a06c00;border:1px solid rgba(240,176,50,.35);border-radius:100px;padding:.55rem 1rem;font-size:.78rem;font-weight:700;cursor:pointer">📣 Publier au réseau</button>
            <button onclick="queteOpenPreuve('${q.id}')" style="flex:1;min-width:130px;background:var(--forest);color:#fff;border:none;border-radius:100px;padding:.55rem 1rem;font-size:.78rem;font-weight:700;cursor:pointer">✅ Déposer ma preuve</button>
          </div>
          <div id="quete-preuve-zone" style="display:none;margin-top:.85rem"></div>`
  +   '</div>'
  + '</div>';
  w.style.display = 'block';
}

function closeQueteModal() {
  const w = document.getElementById('quete-modal');
  if (w) w.style.display = 'none';
}

/* ─── Déposer une preuve sur une quête (photo / mesure / témoignage) ─── */
const PREUVE_TYPES = [
  { id: 'photo',      ic: '📷', label: 'Photo' },
  { id: 'mesure',     ic: '📊', label: 'Mesure chiffrée' },
  { id: 'temoignage', ic: '👥', label: 'Témoignage pair' },
];
function queteOpenPreuve(id) {
  const zone = document.getElementById('quete-preuve-zone');
  if (!zone) return;
  window._quetePreuveType = 'mesure';
  const chip = t => '<button type="button" data-pt="' + t.id + '" onclick="queteSelectPreuveType(\'' + t.id + '\')" style="border:1.5px solid rgba(46,102,66,.2);background:white;color:var(--moss);border-radius:100px;padding:.4rem .8rem;font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s">' + t.ic + ' ' + t.label + '</button>';
  zone.style.display = 'block';
  zone.innerHTML = ''
    + '<div style="background:rgba(46,102,66,.05);border:1px solid rgba(46,102,66,.14);border-radius:14px;padding:1rem 1.1rem">'
      + '<div style="font-size:.72rem;font-weight:700;color:var(--ink);margin-bottom:.55rem">Quelle preuve déposes-tu ?</div>'
      + '<div id="quete-preuve-types" style="display:flex;gap:.45rem;flex-wrap:wrap;margin-bottom:.75rem">' + PREUVE_TYPES.map(chip).join('') + '</div>'
      + '<textarea id="quete-preuve-note" placeholder="Décris ta preuve : ce que tu as fait, une valeur mesurée, un lien…" style="width:100%;min-height:58px;box-sizing:border-box;padding:.6rem .7rem;border:1px solid rgba(46,102,66,.2);border-radius:10px;font-family:inherit;font-size:.78rem;color:var(--ink);resize:vertical"></textarea>'
      + '<button onclick="queteSubmitPreuve(\'' + id + '\')" style="width:100%;margin-top:.7rem;background:var(--forest);color:#fff;border:none;border-radius:100px;padding:.6rem 1rem;font-size:.78rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Enregistrer ma preuve & valider</button>'
    + '</div>';
  queteSelectPreuveType('mesure');
  const ta = document.getElementById('quete-preuve-note'); if (ta) ta.focus();
}
function queteSelectPreuveType(t) {
  window._quetePreuveType = t;
  const box = document.getElementById('quete-preuve-types');
  if (!box) return;
  box.querySelectorAll('[data-pt]').forEach(b => {
    const on = b.getAttribute('data-pt') === t;
    b.style.background = on ? 'var(--forest)' : 'white';
    b.style.color = on ? '#fff' : 'var(--moss)';
    b.style.borderColor = on ? 'var(--forest)' : 'rgba(46,102,66,.2)';
  });
}
function queteSubmitPreuve(id) {
  const t = PREUVE_TYPES.find(x => x.id === (window._quetePreuveType || 'mesure')) || PREUVE_TYPES[1];
  const note = ((document.getElementById('quete-preuve-note') || {}).value || '').trim();
  window._pendingPreuve = { type: t.id, label: t.label, icon: t.ic, note: note };
  validerQuete(id);
  closeQueteModal();
}

// Ouvre la quête Pilote dans la fiche quête standard (même présentation que les autres rôles).
function openPiloteQueteFiche(qid) {
  const pq = (typeof PILOTE_QUETES_DEMO !== 'undefined') ? PILOTE_QUETES_DEMO.find(x => x.id === qid) : null;
  if (!pq || typeof showQueteFiche !== 'function') return;
  const sol = (typeof SOLS !== 'undefined') ? SOLS.find(s => s.nom === pq.source) : null;
  const lieuNom = (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.nom) ? myLieuData.nom : 'Mon lieu';
  const ville = (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.localisation) ? myLieuData.localisation : 'Bordeaux';
  const _solPlan = ((sol && typeof SOLS_INDICATORS !== 'undefined' && SOLS_INDICATORS[sol.nom]) ? SOLS_INDICATORS[sol.nom].plan : null) || [];
  const _solMat = ((sol && typeof SOLS_INDICATORS !== 'undefined' && SOLS_INDICATORS[sol.nom]) ? SOLS_INDICATORS[sol.nom].materiel : null) || [];
  // Quêtes sur mesure : on utilise les champs saisis par le Pilote ; sinon on
  // dérive de la solution d'origine.
  const _plan = (Array.isArray(pq.plan) && pq.plan.length) ? pq.plan : _solPlan;
  const _mat  = (Array.isArray(pq.materiel) && pq.materiel.length) ? pq.materiel : _solMat;
  // Indicateurs (ICI) validés par la preuve : ceux choisis à la création
  // (quête sur mesure) sinon ceux que la solution d'origine rend mesurables.
  const _icis = (Array.isArray(pq.icis) && pq.icis.length && typeof iciGetICI === 'function')
    ? pq.icis.map(id => iciGetICI(id)).filter(Boolean)
    : ((sol && typeof iciPourSolution === 'function') ? (iciPourSolution(sol.nom) || []) : []);
  // Bâtisseurs réellement inscrits (table quete_candidatures) : le Pilote
  // voit son équipe, plus un tableau vide codé en dur.
  const _cands = (window.store) ? store.where('quete_candidatures', function (c) { return c.quete_id === pq.id && c.statut === 'inscrit'; }) : [];
  const _eqCols = ['#4a8c5c', '#c8732a', '#7a6ea8', '#3a6e8c', '#b84e35', '#2e6642'];
  const _equipe = _cands.map(function (c, i) {
    return { i: ((c.batisseur_nom || 'B').trim().charAt(0) || 'B').toUpperCase(), c: _eqCols[i % _eqCols.length], nom: c.batisseur_nom || 'Bâtisseur', bid: c.batisseur_id || null };
  });
  const _nbMax = parseInt(pq.nb, 10) || 6;
  showQueteFiche({
    titre: pq.titre,
    type: (pq.sourceIc || (sol && sol.img) || '⚡') + ' ' + ((sol && sol.cat) || 'Quête'),
    lieu: lieuNom, pilote: lieuNom, ville: ville,
    desc: pq.desc || (sol && sol.desc) || pq.titre,
    impact: pq.impact || (sol && sol.impact) || '',
    plan: _plan,
    materiel: _mat,
    preuve: pq.preuve || 'Photos de l\'action réalisée + indicateurs mesurés.',
    apprendre: pq.competence ? ('Compétence : ' + pq.competence) : ('Mise en œuvre de « ' + ((sol && sol.nom) || pq.titre) + ' ».'),
    duree: pq.duree || '1 journée',
    places: Math.min(_equipe.length, _nbMax) + '/' + _nbMax,
    etape_actuelle: 1, etapes: _plan.length || 4,
    etapeLabels: _plan.length ? _plan.map(p => p.titre) : ['Lancement', 'Préparation', 'Réalisation', 'Certification'],
    tokens: pq.graines || 50, grainesParDemiJour: pq.grainesParDemiJour || null, co2: (sol && sol.co2) || 0,
    esrs: ((sol && sol.esrs) || []).map(e => String(e).replace('ESRS ', '').trim()),
    financement: { objectif: 0, montant: 0, semeur: null },
    equipe: _equipe, dates: [], dateISO: pq.dateISO || null, heure: pq.heure || null,
    icis: _icis,
    srcId: pq.id, published: pq.statut === 'ouverte' || pq.statut === 'terminee', paused: pq.statut === 'en_pause'
  }, 'pilote');
}

/* Publie la quête dans le fil d'action du Réseau, au nom du lieu créé. */
function publishQueteToReseau(qid) {
  const q = (typeof PILOTE_QUETES_DEMO !== 'undefined') ? PILOTE_QUETES_DEMO.find(x => x.id === qid) : null;
  if (!q || typeof RESEAU_POSTS === 'undefined') return;
  const lieu = (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.nom)
    ? { nom: myLieuData.nom, ville: myLieuData.localisation || (typeof EVAD !== 'undefined' ? EVAD.activeLieu.ville : 'Bordeaux') }
    : (typeof EVAD !== 'undefined' ? EVAD.activeLieu : { nom: 'Mon lieu', ville: 'Bordeaux' });
  const ville = (String(lieu.ville).match(/[A-Za-zÀ-ÿ' -]+$/) || [lieu.ville])[0].replace(/^\s*\d{5}\s*/, '').trim() || 'Bordeaux';
  // éviter les doublons exacts en tête de fil
  if (!(RESEAU_POSTS[0] && RESEAU_POSTS[0].quest && RESEAU_POSTS[0].quest.titre === q.titre && RESEAU_POSTS[0].author === lieu.nom)) {
    RESEAU_POSTS.unshift({
      profile: 'pilote', author: lieu.nom, lieu: ville, time: "à l'instant",
      type: 'quete', regen: 'entreprendre',
      text: "On lance une nouvelle quête sur notre lieu ⚡ « " + q.titre + " ». On mobilise des Bâtisseurs, rejoignez-nous !",
      quest: { titre: q.titre, meta: [q.duree, q.nb, (q.graines + ' graines')].filter(Boolean).join(' · ') },
      cta: 'Rejoindre la quête'
    });
  }
  closeQueteModal();
  showScreen('reseau');
  setTimeout(() => {
    if (typeof reseauTab === 'function') { try { reseauTab('fil', document.getElementById('rtab-fil')); } catch (e) {} }
    if (typeof reseauSetFilter === 'function') reseauSetFilter('tout', document.querySelector('.reseau-filter[data-f="tout"]'));
  }, 120);
  if (typeof mmBubble === 'function') mmBubble('📣 Quête publiée au Réseau !');
}

/* Les quêtes ne sont plus générées automatiquement depuis les solutions :
   le Pilote crée les siennes via « + Nouvelle quête ». On recharge ici
   celles qu'il a créées (persistées dans le store, marquées custom). */
function syncPiloteQuetesFromLieu() {
  if (typeof PILOTE_QUETES_DEMO === 'undefined') return;
  PILOTE_QUETES_DEMO.length = 0;
  if (!window.store) return;

  // Lieu de référence du Pilote : on privilégie myLieuData dès qu'il a une
  // identité (fiche publiée) OU des solutions ; sinon la fiche en cours (cData).
  // Garder l'id fiable est essentiel : c'est lui qui rattache les quêtes au lieu.
  const L = (typeof myLieuData !== 'undefined' && myLieuData && (myLieuData.id || (myLieuData.solutions || []).length))
    ? myLieuData
    : (typeof cData !== 'undefined' ? cData : null);
  // Repli sur solsByEspace si le champ à plat est vide (fiches anciennes).
  const sols = (typeof evadLieuSols === 'function') ? evadLieuSols(L) : ((L && L.solutions) || []);
  // Quêtes effectivement retenues (curation de l'onglet Quêtes du wizard) :
  // solutions de la fiche ∪ quêtes ajoutées − quêtes retirées.
  const queteSols = (typeof evadLieuQueteSols === 'function') ? evadLieuQueteSols(L) : sols;
  const queteSolSet = new Set(queteSols);
  const quetesRetirees = new Set((L && L.quetesRetirees) || []);
  const myLieuId = (L && L.id) || null;

  // Rattachement à l'espace (pour classer les quêtes par espace dans le tableau
  // de bord) : solution -> index d'espace, via solsByEspace de la fiche.
  const espData   = (L && L.espacesData) || [];
  const solsByEsp = (L && L.solsByEspace) || {};
  const solEspIdx = {};
  Object.keys(solsByEsp).forEach(function (k) {
    (solsByEsp[k] || []).forEach(function (n) { if (solEspIdx[n] == null) solEspIdx[n] = +k; });
  });
  // Quêtes ajoutées depuis la bibliothèque dans le wizard : leur espace est
  // mémorisé dans quetesEspMap (elles n'apparaissent pas dans solsByEspace).
  const qEspMap = (L && L.quetesEspMap) || {};
  Object.keys(qEspMap).forEach(function (n) {
    if (solEspIdx[n] == null && qEspMap[n] != null) solEspIdx[n] = +qEspMap[n];
  });
  const espNomOf = function (idx) {
    if (idx == null) return null;
    const e = espData[idx];
    return (e && (e.nom || e.eid)) || ('Espace ' + (idx + 1));
  };

  // 1. Proposer une quête « à publier » pour chaque solution retenue qui en a une
  //    (créée une seule fois dans le store ; on ne réécrase pas si déjà publiée/retirée).
  if (typeof SOLS !== 'undefined') {
    queteSols.forEach(function (nom) {
      const sol = SOLS.find(function (s) { return s.nom === nom; });
      if (!sol || !sol.quete) return;
      // id propre au lieu → pas de collision entre Pilotes en base.
      const lieuId = (L && L.id) || 'draft';
      const qid = lieuId + '-sol-' + String(nom).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      // Ne pas re-générer (ni re-pousser) une quête de solution supprimée/retirée.
      if (!store.get('quetes', qid) && !quetesRetirees.has('sol:' + nom)) {
        store.upsert('quetes', {
          id: qid, lieu_id: (L && L.id) || null, custom: false, source: nom, sourceIc: sol.img || '⚡',
          titre: sol.quete.titre, duree: sol.quete.duree || '-', nb: sol.quete.nb || '-',
          graines: 50, impact: sol.quete.impact_quete || '', statut: 'a_verifier'
        });
      }
    });
  }

  // 2. Charger les quêtes du lieu : créées manuellement (custom) OU proposées
  //    depuis une solution actuellement dans la fiche. Hors quêtes retirées.
  store.where('quetes', function (r) {
    if (r.statut === 'retiree') return false;
    // Quête d'une solution explicitement retirée dans l'onglet Quêtes : masquée
    // (sauf si déjà publiée « ouverte » ou terminée, on ne dépublie pas en douce).
    if (!r.custom && r.source && quetesRetirees.has('sol:' + r.source) && r.statut !== 'ouverte' && r.statut !== 'terminee') return false;
    // Lieu identifié (fiche créée) : on n'affiche QUE ses propres quêtes, celles
    // effectivement sélectionnées ou créées pendant la création de la fiche.
    // Cela évite les doublons issus d'anciens brouillons ou d'autres lieux qui
    // partagent un nom de solution.
    if (myLieuId) return r.lieu_id === myLieuId;
    // Pas encore d'id (brouillon) : quête créée manuellement ou issue d'une
    // solution retenue dans la fiche en cours, MAIS uniquement les quêtes
    // locales du brouillon (lieu_id vide ou placeholder). Sans ce garde, les
    // quêtes des AUTRES Pilotes (hydratées de Supabase dans le store) entrent
    // dans la liste et gonflent la Vadité avec des preuves qui ne sont pas
    // les nôtres.
    const isDraftRow = !r.lieu_id || r.lieu_id === 'draft' || r.lieu_id === 'lieu-demo';
    return isDraftRow && (r.custom === true || (r.source && queteSolSet.has(r.source)));
  }).forEach(function (r) {
    // Quête terminée en base : re-crédite la Vadité de session (le Set
    // quetesValidees ne survit pas au rechargement, le statut si).
    if (r.statut === 'terminee' && typeof quetesValidees !== 'undefined') quetesValidees.add(r.id);
    // Index d'espace : explicite (quête sur mesure) ou déduit de la solution.
    let _espIdx = (r.espIdx != null) ? r.espIdx
                : (r.donnees && r.donnees.espIdx != null) ? r.donnees.espIdx
                : (r.source != null && solEspIdx[r.source] != null) ? solEspIdx[r.source]
                : null;
    PILOTE_QUETES_DEMO.push({
      id: r.id, titre: r.titre || 'Quête', statut: r.statut || 'a_verifier',
      duree: r.duree || '-', nb: r.nb || '-', graines: r.graines || 50,
      impact: r.impact || '', source: r.source || null,
      sourceIc: r.sourceIc || '⚡', custom: r.custom === true,
      espIdx: _espIdx, espNom: espNomOf(_espIdx),
      // desc éditée par le Pilote (sinon dérivée de la solution à l'ouverture).
      desc: r.desc || (r.donnees && r.donnees.desc) || null,
      // Date choisie au calendrier + heure (persistées dans donnees).
      dateISO: r.dateISO || (r.donnees && r.donnees.dateISO) || null,
      heure: r.heure || (r.donnees && r.donnees.heure) || null,
      // Champs saisis à la création manuelle (quêtes sur mesure).
      competence: r.competence || (r.donnees && r.donnees.competence) || null,
      materiel: r.materiel || (r.donnees && r.donnees.materiel) || null,
      plan: r.plan || (r.donnees && r.donnees.plan) || null,
      preuve: r.preuve || (r.donnees && r.donnees.preuve) || null,
      // Indicateurs (ICI) que la preuve de la quête vient valider.
      icis: r.icis || (r.donnees && r.donnees.icis) || null
    });
  });
}

/* ─── Création manuelle d'une quête par le Pilote ─── */
function piloteQueteCreerEnsureDom() {
  if (document.getElementById('pq-create-modal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'pq-create-modal';
  // Positionnement (tiroir latéral vs plein écran mobile) géré en CSS via
  // #pq-create-modal, pour laisser les media queries ajuster le décalage gauche.
  wrap.style.cssText = 'display:none;z-index:10030;font-family:\'Satoshi\',sans-serif;background:var(--paper);overflow-y:auto';
  const inputStyle = 'width:100%;padding:.55rem .7rem;border-radius:10px;border:1px solid rgba(46,102,66,.2);font-family:inherit;font-size:.82rem;color:var(--ink);background:#fff;box-sizing:border-box';
  const labelStyle = 'display:block;font-size:.72rem;font-weight:700;color:var(--moss);margin:.75rem 0 .3rem';
  wrap.innerHTML =
    // Barre sticky (comme la fiche quête) : « ← Retour » + titre.
    '<div style="position:sticky;top:0;z-index:2;background:rgba(233,242,233,.96);backdrop-filter:blur(6px);border-bottom:1px solid rgba(46,102,66,.12);padding:.9rem 1.2rem;display:flex;align-items:center;gap:1rem">'
  +   '<button onclick="piloteQueteCreerFermer()" style="flex-shrink:0;font-size:.78rem;font-weight:700;padding:.42rem .95rem;border:1px solid rgba(46,102,66,.2);border-radius:100px;background:#fff;color:var(--forest);cursor:pointer;font-family:inherit">← Retour</button>'
  +   '<div id="pq-create-title" style="font-size:1rem;font-weight:800;color:var(--ink)">⚡ Nouvelle quête</div>'
  + '</div>'
  // Colonne de contenu centrée.
  + '<div style="max-width:640px;margin:0 auto;padding:1.3rem 1.4rem 3rem">'
  +   '<div style="font-size:.78rem;line-height:1.5;color:var(--moss);margin-bottom:.5rem">Une action concrète sur ton lieu. Une fois publiée, les bâtisseurs pourront la rejoindre.</div>'
  // Coup de main de Deva : affiché hors production seulement (voir
  // piloteQueteCreerOuvrir). Elle propose, elle ne décide pas : rien n'est
  // écrasé, tout reste modifiable, et la quête n'est jamais validée pour toi.
  +   '<div id="pq-deva-aide" style="display:none;background:rgba(1,130,98,.05);border:1px solid rgba(1,130,98,.18);border-radius:12px;padding:.7rem .8rem;margin-bottom:.9rem">'
  +     '<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">'
  +       '<span style="font-size:1.1rem">🌱</span>'
  +       '<div style="flex:1;min-width:140px;font-size:.72rem;color:var(--moss);line-height:1.45">Deva peut proposer une première version : champs, étapes, matériel et preuve.</div>'
  +       '<button type="button" id="pq-deva-btn" onclick="pqCreerDevaAide()" style="flex-shrink:0;background:var(--forest);color:#fff;border:none;border-radius:100px;padding:.45rem 1rem;font-size:.74rem;font-weight:700;cursor:pointer;font-family:inherit">✨ Deva m\'aide</button>'
  +     '</div>'
  +     '<div id="pq-deva-etat" style="font-size:.7rem;color:var(--moss);margin-top:.5rem;line-height:1.5"></div>'
  +   '</div>'
  +   '<label style="' + labelStyle + '" for="pq-create-titre">Titre de la quête *</label>'
  +   '<input id="pq-create-titre" style="' + inputStyle + '" placeholder="Ex : Planter la haie champêtre du verger">'
  +   '<label style="' + labelStyle + '" for="pq-create-desc">📝 Description</label>'
  +   '<textarea id="pq-create-desc" rows="2" style="' + inputStyle + ';resize:vertical" placeholder="L\'action concrète à réaliser sur le lieu…"></textarea>'
  +   '<div style="display:flex;gap:.6rem">'
  +     '<div style="flex:1"><label style="' + labelStyle + '" for="pq-create-duree">Durée</label>'
  +     '<input id="pq-create-duree" style="' + inputStyle + '" placeholder="Ex : 1 journée"></div>'
  +     '<div style="flex:1"><label style="' + labelStyle + '" for="pq-create-nb">Participants</label>'
  +     '<input id="pq-create-nb" style="' + inputStyle + '" placeholder="Ex : 2–4 pers."></div>'
  +   '</div>'
  +   '<div style="display:flex;gap:.6rem">'
  +     '<div style="flex:1"><label style="' + labelStyle + '" for="pq-create-graines">🌱 Graines / demi-journée / pers.</label>'
  +     '<input id="pq-create-graines" type="number" min="0" style="' + inputStyle + '" placeholder="25"></div>'
  +     '<div style="flex:1"><label style="' + labelStyle + '" for="pq-create-espace">📍 Espace concerné</label>'
  +     '<select id="pq-create-espace" style="' + inputStyle + ';cursor:pointer"></select></div>'
  +   '</div>'
  +   '<label style="' + labelStyle + '">📅 Dates possibles <span style="font-weight:400;opacity:.7">(une ou plusieurs)</span></label>'
  +   '<div id="pq-create-dates"></div>'
  +   '<button type="button" onclick="pqCreerAddDate()" style="margin-top:.35rem;background:rgba(46,102,66,.07);border:1px dashed rgba(46,102,66,.3);color:var(--forest);border-radius:8px;padding:.4rem .75rem;font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">+ Ajouter une date</button>'
  +   '<label style="' + labelStyle + '" for="pq-create-competence">🎯 Compétence nécessaire</label>'
  +   '<select id="pq-create-competence" style="' + inputStyle + '">'
  +     ['Aucune en particulier','🔨 Bricolage','🏗 Chantier participatif','💧 Gestion de l\'eau','⚡ Énergie','🧱 Éco-construction','🌾 Maraîchage & permaculture','♻️ Réemploi & compostage','🌿 Biodiversité','🤝 Animation & facilitation','🌡 Adaptation climatique','🔧 Autre / polyvalent'].map(function(o){return '<option>'+o+'</option>';}).join('')
  +   '</select>'
  +   '<label style="' + labelStyle + '" for="pq-create-impact">🌿 Impact visé (facultatif)</label>'
  +   '<input id="pq-create-impact" style="' + inputStyle + '" placeholder="Ex : +8 pts eau · 200 m de haie">'
  +   '<label style="' + labelStyle + '" for="pq-create-materiel">🧰 Matériel nécessaire <span style="font-weight:400;opacity:.7">(un par ligne)</span></label>'
  +   '<textarea id="pq-create-materiel" rows="3" style="' + inputStyle + ';resize:vertical" placeholder="Bêche\nPlants d\'arbustes locaux\nPaillage"></textarea>'
  +   '<label style="' + labelStyle + '">🪜 Étapes de la quête <span style="font-weight:400;opacity:.7">(détaille et valide chaque étape)</span></label>'
  +   '<div id="pq-create-etapes-list"></div>'
  +   '<button type="button" onclick="pqCreerAddEtape()" style="margin-top:.35rem;background:rgba(46,102,66,.07);border:1px dashed rgba(46,102,66,.3);color:var(--forest);border-radius:8px;padding:.4rem .75rem;font-size:.72rem;font-weight:700;cursor:pointer;font-family:inherit">+ Ajouter une étape</button>'
  +   '<label style="' + labelStyle + '" for="pq-create-preuve">✅ Preuve pour valider la quête</label>'
  +   '<textarea id="pq-create-preuve" rows="2" style="' + inputStyle + ';resize:vertical" placeholder="Ex : photos avant/après + nombre de plants installés">Photos de l\'action réalisée + indicateurs mesurés.</textarea>'
  +   '<label style="' + labelStyle + '">📊 Indicateurs validés par la preuve <span style="font-weight:400;opacity:.7">(la preuve alimente leur suivi)</span></label>'
  +   '<div id="pq-create-icis" style="display:flex;flex-wrap:wrap;gap:.3rem;margin-top:.1rem">'
  +     ((typeof ICI_CATALOG!=='undefined'?ICI_CATALOG:[]).map(function(ici){var m=((typeof ICI_LIVRE_META!=='undefined')?ICI_LIVRE_META[ici.livre]:null)||{ic:'◆',col:'#4a8c5c'};return '<button type="button" data-ici="'+ici.id+'" data-col="'+m.col+'" data-sel="0" onclick="pqCreerToggleIci(this)" style="font-size:.66rem;font-weight:600;color:'+m.col+';background:transparent;border:1px solid '+m.col+'55;border-radius:100px;padding:.28rem .6rem;cursor:pointer;font-family:inherit">'+m.ic+' '+ici.nom+'</button>';}).join(''))
  +   '</div>'
  +   '<div id="pq-create-hint" style="font-size:.7rem;color:var(--terracotta);margin-top:.45rem;min-height:1rem"></div>'
  +   '<div style="display:flex;align-items:center;justify-content:flex-end;gap:.6rem;margin-top:.4rem">'
  +     '<button onclick="piloteQueteCreerFermer()" style="background:none;border:none;color:var(--moss);font-size:.8rem;font-weight:600;cursor:pointer;padding:.5rem .6rem;font-family:inherit">Annuler</button>'
  +     '<button id="pq-create-submit" onclick="piloteQueteCreerSave()" style="background:var(--forest);color:#fff;border:none;border-radius:100px;padding:.55rem 1.3rem;font-size:.8rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Valider la quête</button>'
  +   '</div>'
  + '</div>';
  document.body.appendChild(wrap);
}

/* ─── Dates possibles (multi) ─── */
function pqCreerAddDate(val) {
  const list = document.getElementById('pq-create-dates');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'pq-date-row';
  row.style.cssText = 'display:flex;gap:.4rem;align-items:center;margin-bottom:.35rem';
  row.innerHTML =
      '<input type="date" class="pq-date-input" value="' + (val || '') + '" style="flex:1;padding:.5rem .6rem;border:1px solid rgba(46,102,66,.2);border-radius:8px;font-family:inherit;font-size:.8rem;color:var(--ink)">'
    + '<button type="button" onclick="this.closest(\'.pq-date-row\').remove()" title="Retirer cette date" style="flex-shrink:0;background:none;border:none;color:var(--moss);opacity:.5;font-size:.85rem;cursor:pointer">🗑️</button>';
  list.appendChild(row);
}

/* ─── Étapes détaillées + validation par étape ─── */
function pqCreerAddEtape(titre, desc, done) {
  const list = document.getElementById('pq-create-etapes-list');
  if (!list) return;
  const esc = (s) => String(s || '').replace(/"/g, '&quot;');
  const isDone = !!done;
  const row = document.createElement('div');
  row.className = 'pq-etape-row';
  row.dataset.done = isDone ? '1' : '0';
  row.style.cssText = 'border:1px solid rgba(46,102,66,.15);border-radius:10px;padding:.5rem .6rem;margin-bottom:.45rem;background:' + (isDone ? 'rgba(74,140,92,.08)' : '#fff');
  row.innerHTML =
      '<div style="display:flex;gap:.4rem;align-items:center">'
    +   '<input class="pq-etape-titre" placeholder="Titre de l\'étape" value="' + esc(titre) + '" style="flex:1;min-width:0;padding:.4rem .55rem;border:1px solid rgba(46,102,66,.2);border-radius:8px;font-family:inherit;font-size:.78rem;color:var(--ink)">'
    +   '<button type="button" class="pq-etape-valider" onclick="pqCreerToggleEtape(this)" style="flex-shrink:0;border:1px solid ' + (isDone ? 'var(--forest)' : 'rgba(46,102,66,.25)') + ';background:' + (isDone ? 'var(--forest)' : '#fff') + ';color:' + (isDone ? '#fff' : 'var(--moss)') + ';border-radius:100px;padding:.32rem .65rem;font-size:.68rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap">' + (isDone ? '✓ Validée' : 'Valider') + '</button>'
    +   '<button type="button" onclick="this.closest(\'.pq-etape-row\').remove()" title="Supprimer l\'étape" style="flex-shrink:0;background:none;border:none;color:var(--moss);opacity:.5;font-size:.85rem;cursor:pointer">🗑️</button>'
    + '</div>'
    + '<input class="pq-etape-desc" placeholder="Détail / consigne (facultatif)" value="' + esc(desc) + '" style="width:100%;box-sizing:border-box;margin-top:.35rem;padding:.35rem .55rem;border:1px solid rgba(46,102,66,.15);border-radius:8px;font-family:inherit;font-size:.72rem;color:var(--moss)">';
  list.appendChild(row);
}

// Valide / annule la validation d'une étape (toggle).
function pqCreerToggleEtape(btn) {
  const row = btn.closest('.pq-etape-row');
  if (!row) return;
  const done = row.dataset.done === '1';
  row.dataset.done = done ? '0' : '1';
  if (done) {
    btn.textContent = 'Valider'; btn.style.background = '#fff'; btn.style.color = 'var(--moss)'; btn.style.borderColor = 'rgba(46,102,66,.25)';
    row.style.background = '#fff';
  } else {
    btn.textContent = '✓ Validée'; btn.style.background = 'var(--forest)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--forest)';
    row.style.background = 'rgba(74,140,92,.08)';
  }
}

// Peuple le select « Espace concerné » depuis les espaces du lieu.
// Source des espaces : lieu publié (myLieuData), sinon éditeur (ficheEspaces),
// sinon assistant de création guidé (cData.espacesData).
function _pqEspacesSource() {
  if (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.espacesData && myLieuData.espacesData.length) return myLieuData.espacesData;
  if (typeof ficheEspaces !== 'undefined' && ficheEspaces && ficheEspaces.length) return ficheEspaces;
  if (typeof cData !== 'undefined' && cData && cData.espacesData && cData.espacesData.length) return cData.espacesData;
  return [];
}
function pqCreerRenderEspaces(selIdx) {
  const sel = document.getElementById('pq-create-espace');
  if (!sel) return;
  const esps = _pqEspacesSource();
  sel.innerHTML = '<option value="">— Aucun / tout le lieu —</option>'
    + esps.map((e, i) => '<option value="' + i + '"' + (String(selIdx) === String(i) ? ' selected' : '') + '>' + String(e.nom || ('Espace ' + (i + 1))).replace(/[<>]/g, '') + '</option>').join('');
}

function piloteQueteCreerOuvrir(editId) {
  piloteQueteCreerEnsureDom();
  // Quête à éditer (si un id est fourni et qu'elle existe).
  const editQ = (editId != null && typeof PILOTE_QUETES_DEMO !== 'undefined')
    ? PILOTE_QUETES_DEMO.find(x => x.id === editId) : null;
  pqCreerEditId = editQ ? editQ.id : null;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); };
  set('pq-create-titre', editQ ? editQ.titre : '');
  set('pq-create-desc', editQ ? editQ.desc : '');
  set('pq-create-duree', editQ && editQ.duree && editQ.duree !== '-' ? editQ.duree : '');
  set('pq-create-nb', editQ && editQ.nb && editQ.nb !== '-' ? editQ.nb : '');
  set('pq-create-graines', editQ ? (editQ.grainesParDemiJour || editQ.graines || '') : '');
  set('pq-create-impact', editQ ? editQ.impact : '');
  set('pq-create-materiel', editQ && Array.isArray(editQ.materiel) ? editQ.materiel.join('\n') : '');

  const cmp = document.getElementById('pq-create-competence');
  if (cmp) {
    cmp.selectedIndex = 0;
    if (editQ && editQ.competence) {
      const opt = Array.from(cmp.options).findIndex(o => o.value === editQ.competence || o.text === editQ.competence);
      if (opt >= 0) cmp.selectedIndex = opt;
    }
  }
  const prv = document.getElementById('pq-create-preuve');
  if (prv) prv.value = (editQ && editQ.preuve) ? editQ.preuve : 'Photos de l\'action réalisée + indicateurs mesurés.';

  // Indicateurs (ICI) : re-sélectionne ceux de la quête.
  const _icis = (editQ && Array.isArray(editQ.icis)) ? editQ.icis : [];
  document.querySelectorAll('#pq-create-icis [data-ici]').forEach(b => {
    const sel = _icis.includes(b.getAttribute('data-ici'));
    b.setAttribute('data-sel', sel ? '1' : '0');
    const col = b.getAttribute('data-col') || '#018262';
    b.style.background = sel ? (col + '18') : 'transparent';
    b.style.borderColor = sel ? col : (col + '55');
    b.style.fontWeight = sel ? '800' : '600';
  });
  const hint = document.getElementById('pq-create-hint'); if (hint) hint.textContent = '';
  // Coup de main de Deva : dev.evad.org, préview et local. Jamais en production.
  const devaBox = document.getElementById('pq-deva-aide');
  if (devaBox) {
    var horsProd = !!(window.EVAD_SUPABASE_ENV && !window.EVAD_SUPABASE_ENV.isProd);
    devaBox.style.display = horsProd ? 'block' : 'none';
    var etat = document.getElementById('pq-deva-etat'); if (etat) etat.textContent = '';
  }

  // Dates possibles : celles de la quête, sinon une ligne vide.
  const datesBox = document.getElementById('pq-create-dates'); if (datesBox) datesBox.innerHTML = '';
  const _dates = (editQ && Array.isArray(editQ.datesISO) && editQ.datesISO.length) ? editQ.datesISO
    : (editQ && editQ.dateISO ? [editQ.dateISO] : []);
  if (_dates.length) _dates.forEach(d => pqCreerAddDate(d)); else pqCreerAddDate();

  // Étapes : celles de la quête (titre + desc + validée), sinon une ligne vide.
  const etapesBox = document.getElementById('pq-create-etapes-list'); if (etapesBox) etapesBox.innerHTML = '';
  const _plan = (editQ && Array.isArray(editQ.plan) && editQ.plan.length) ? editQ.plan : [];
  if (_plan.length) _plan.forEach(s => pqCreerAddEtape(s.titre, s.desc, s.done)); else pqCreerAddEtape();

  // Espace : celui de la quête en édition, sinon le flux guidé.
  const _preEsp = editQ ? (editQ.espIdx != null ? editQ.espIdx : '')
    : ((typeof window !== 'undefined' && window._creerQueteEspIdx != null) ? window._creerQueteEspIdx : '');
  if (typeof pqCreerRenderEspaces === 'function') pqCreerRenderEspaces(_preEsp);

  // Titre + bouton adaptés au mode.
  const titleEl = document.getElementById('pq-create-title');
  if (titleEl) titleEl.textContent = editQ ? '✏️ Modifier la quête' : '⚡ Nouvelle quête';
  const submitEl = document.getElementById('pq-create-submit');
  if (submitEl) submitEl.textContent = editQ ? '💾 Enregistrer' : '✅ Valider la quête';

  // Afficher, forcer un reflux, puis animer. Le reflux fait démarrer la
  // transition depuis translateX(-100%) ; sans lui le panneau apparaîtrait en
  // place. On n'utilise pas requestAnimationFrame : il ne se déclenche pas
  // quand l'onglet est en arrière-plan, et le panneau resterait alors hors champ.
  const _m = document.getElementById('pq-create-modal');
  _m.style.display = 'block';
  _m.scrollTop = 0;
  void _m.offsetWidth;
  _m.classList.add('pq-ouvert');
  setTimeout(() => { const t = document.getElementById('pq-create-titre'); if (t) t.focus(); }, 60);
}

/* ── Coup de main de Deva sur le formulaire de quête (hors production) ──────
   Deva propose une première version : elle remplit les champs LAISSÉS VIDES et
   suggère la preuve et les indicateurs qu'elle valide. Trois règles tenues ici :
     - elle n'écrase jamais ce que le Pilote a déjà écrit ;
     - elle ajoute des indicateurs, elle n'en retire aucun ;
     - elle ne valide pas la quête à sa place, le bouton reste à lui.
   Le modèle ne calcule aucune graine : le nombre proposé reste une suggestion
   affichée dans un champ modifiable, comme le reste. */
function pqDevaEtat(msg, erreur) {
  const el = document.getElementById('pq-deva-etat');
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = erreur ? 'var(--terracotta)' : 'var(--moss)';
}

// Contexte transmis : le lieu, l'espace visé, ce qui est déjà saisi, et les
// listes fermées dans lesquelles Deva doit choisir (compétences, indicateurs).
function pqDevaContexte() {
  const val = (id) => { const e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; };
  const lieu = (typeof myLieuData !== 'undefined' && myLieuData) ? myLieuData : {};
  const espSel = document.getElementById('pq-create-espace');
  const cmp = document.getElementById('pq-create-competence');
  const competences = cmp ? Array.from(cmp.options).map(o => o.text) : [];
  const icis = Array.from(document.querySelectorAll('#pq-create-icis [data-ici]'))
    .map(b => ({ id: b.getAttribute('data-ici'), nom: b.textContent.trim() }));
  return {
    lieu: { nom: lieu.nom || '', type: lieu.type || lieu.autreType || '', ville: lieu.localisation || lieu.ville || '' },
    espace: espSel && espSel.selectedIndex >= 0 ? (espSel.options[espSel.selectedIndex] || {}).text || '' : '',
    deja_saisi: {
      titre: val('pq-create-titre'), description: val('pq-create-desc'),
      duree: val('pq-create-duree'), participants: val('pq-create-nb'),
      impact: val('pq-create-impact'), materiel: val('pq-create-materiel')
    },
    competences_possibles: competences,
    indicateurs_possibles: icis
  };
}

// Un modèle de langage répond rarement en JSON pur : on récupère le premier
// objet complet du texte plutôt que d'échouer sur une phrase d'introduction.
function pqDevaExtraireJson(texte) {
  if (!texte) return null;
  var t = String(texte).replace(/```json/gi, '```').split('```').join('\n');
  var d = t.indexOf('{');
  if (d < 0) return null;
  var prof = 0;
  for (var i = d; i < t.length; i++) {
    if (t[i] === '{') prof++;
    else if (t[i] === '}') { prof--; if (prof === 0) { try { return JSON.parse(t.slice(d, i + 1)); } catch (e) { return null; } } }
  }
  return null;
}

async function pqCreerDevaAide() {
  const btn = document.getElementById('pq-deva-btn');
  if (btn && btn.disabled) return;
  if (typeof DEVA_API_URL === 'undefined' || !DEVA_API_URL) {
    pqDevaEtat('Deva n\'est pas reliée à son moteur sur cet environnement.', true);
    return;
  }
  if (btn) { btn.disabled = true; btn.style.opacity = '.6'; btn.textContent = '… Deva réfléchit'; }
  pqDevaEtat('Deva regarde ton lieu et prépare une proposition…');

  const ctx = pqDevaContexte();
  const consigne =
      'Tu aides un Pilote de lieu régénératif à rédiger une quête, une action concrète que des Bâtisseurs viendront réaliser sur place. '
    + 'Réponds UNIQUEMENT par un objet JSON, sans phrase autour, avec ces clés : '
    + 'titre (string court), description (string, 2 phrases max), duree (string, ex "1 journée"), participants (string, ex "2-4 pers."), '
    + 'graines (entier, reconnaissance par demi-journée et par personne, entre 10 et 60), competence (string, EXACTEMENT une valeur de competences_possibles), '
    + 'impact (string court et mesurable), materiel (tableau de strings), etapes (tableau de 3 à 5 objets {titre, desc}), '
    + 'preuve (string : ce que le Bâtisseur devra fournir pour prouver que l\'action est faite, concret et vérifiable), '
    + 'indicateurs (tableau d\'id pris EXACTEMENT dans indicateurs_possibles, ceux que cette preuve permet de mesurer, 1 à 3). '
    + 'N\'invente aucune valeur hors des listes fournies. Écris en français, tutoiement, sans vocabulaire marchand : '
    + 'jamais de prix, de paiement, de salaire ni de rémunération. Les graines sont reçues en reconnaissance, jamais gagnées ni payées.';

  try {
    const r = await fetch(DEVA_API_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [
        { role: 'system', content: consigne },
        { role: 'user', content: JSON.stringify(ctx) }
      ] })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const prop = pqDevaExtraireJson(data && data.reply);
    if (!prop) throw new Error('réponse illisible');
    const rempli = pqDevaAppliquer(prop);
    pqDevaEtat(rempli.length
      ? 'Deva a proposé : ' + rempli.join(', ') + '. Tout reste modifiable, et c\'est toi qui valides.'
      : 'Tes champs étaient déjà remplis : Deva n\'a rien remplacé.');
  } catch (e) {
    pqDevaEtat('Deva n\'a pas pu répondre (' + (e.message || 'erreur') + '). Réessaie dans un instant.', true);
  }
  if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.textContent = '✨ Deva m\'aide'; }
}

// Remplit les champs VIDES uniquement, et rend la liste de ce qui a été touché.
function pqDevaAppliquer(p) {
  const faits = [];
  const setSiVide = (id, v, label) => {
    const el = document.getElementById(id);
    if (!el || v == null || String(v).trim() === '') return;
    if (String(el.value || '').trim() !== '') return;
    el.value = String(v).trim();
    faits.push(label);
  };
  setSiVide('pq-create-titre', p.titre, 'le titre');
  setSiVide('pq-create-desc', p.description, 'la description');
  setSiVide('pq-create-duree', p.duree, 'la durée');
  setSiVide('pq-create-nb', p.participants, 'le nombre de participants');
  setSiVide('pq-create-graines', p.graines, 'les graines');
  setSiVide('pq-create-impact', p.impact, 'l\'impact visé');
  if (Array.isArray(p.materiel) && p.materiel.length) setSiVide('pq-create-materiel', p.materiel.join('\n'), 'le matériel');

  // Compétence : seulement si le Pilote est resté sur « Aucune en particulier ».
  const cmp = document.getElementById('pq-create-competence');
  if (cmp && cmp.selectedIndex === 0 && p.competence) {
    const i = Array.from(cmp.options).findIndex(o => o.text === p.competence || o.value === p.competence);
    if (i > 0) { cmp.selectedIndex = i; faits.push('la compétence'); }
  }

  // Preuve : remplacée si vide OU si c'est encore la phrase par défaut.
  const prv = document.getElementById('pq-create-preuve');
  const defaut = 'Photos de l\'action réalisée + indicateurs mesurés.';
  if (prv && p.preuve && (!prv.value.trim() || prv.value.trim() === defaut)) {
    prv.value = String(p.preuve).trim();
    faits.push('la preuve');
  }

  // Étapes : seulement si aucune n'est renseignée (le formulaire en pose une vide).
  if (Array.isArray(p.etapes) && p.etapes.length && typeof pqCreerAddEtape === 'function') {
    const titres = Array.from(document.querySelectorAll('#pq-create-etapes-list .pq-etape-titre'));
    const vide = titres.every(t => !String(t.value || '').trim());
    if (vide) {
      const box = document.getElementById('pq-create-etapes-list');
      if (box) box.innerHTML = '';
      p.etapes.slice(0, 6).forEach(e => pqCreerAddEtape(e && e.titre, e && e.desc, false));
      faits.push('les étapes');
    }
  }

  // Indicateurs : on ajoute la sélection proposée, on n'en retire jamais.
  if (Array.isArray(p.indicateurs) && p.indicateurs.length) {
    let n = 0;
    p.indicateurs.forEach(id => {
      const b = document.querySelector('#pq-create-icis [data-ici="' + String(id).replace(/"/g, '') + '"]');
      if (b && b.getAttribute('data-sel') !== '1') { pqCreerToggleIci(b); n++; }
    });
    if (n) faits.push(n + ' indicateur' + (n > 1 ? 's' : ''));
  }
  return faits;
}

function piloteQueteCreerFermer() {
  const m = document.getElementById('pq-create-modal');
  if (m) {
    // Glissement inverse, puis retrait : sans le délai, le panneau disparaît
    // d'un coup et l'animation d'ouverture paraît bancale par contraste.
    m.classList.remove('pq-ouvert');
    setTimeout(() => { m.style.display = 'none'; }, 320);
  }
  pqCreerEditId = null;
  // Le rattachement à un espace ne vaut que pour la création en cours.
  if (typeof window !== 'undefined') window._creerQueteEspIdx = null;
}

/* Sélection d'un indicateur (ICI) que la preuve de la quête viendra valider. */
function pqCreerToggleIci(el) {
  const on = el.getAttribute('data-sel') === '1';
  const col = el.getAttribute('data-col') || '#018262';
  el.setAttribute('data-sel', on ? '0' : '1');
  el.style.background = on ? 'transparent' : (col + '18');
  el.style.borderColor = on ? (col + '55') : col;
  el.style.fontWeight = on ? '600' : '800';
}

function piloteQueteCreerSave() {
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const titre = val('pq-create-titre');
  if (!titre) {
    const hint = document.getElementById('pq-create-hint');
    if (hint) hint.textContent = 'Donne un titre à ta quête 🙂';
    const t = document.getElementById('pq-create-titre'); if (t) t.focus();
    return false;
  }
  const lignes = (id) => val(id).split('\n').map(l => l.trim()).filter(Boolean);
  const cmpEl = document.getElementById('pq-create-competence');
  const competence = (cmpEl && cmpEl.selectedIndex > 0) ? cmpEl.value : '';
  // Dates possibles (multi) → dateISO = première date pour l'agenda/suivi.
  const datesISO = Array.from(document.querySelectorAll('#pq-create-dates .pq-date-input')).map(i => i.value).filter(Boolean);
  // Étapes détaillées (titre + desc + validée).
  const plan = Array.from(document.querySelectorAll('#pq-create-etapes-list .pq-etape-row')).map(r => ({
    ic: '🪜',
    titre: ((r.querySelector('.pq-etape-titre') || {}).value || '').trim(),
    desc:  ((r.querySelector('.pq-etape-desc')  || {}).value || '').trim(),
    done:  r.dataset.done === '1'
  })).filter(s => s.titre);
  // Espace concerné (select) ; repli sur le flux guidé.
  const espSel = document.getElementById('pq-create-espace');
  let espIdx = (espSel && espSel.value !== '') ? parseInt(espSel.value, 10) : null;
  if (espIdx == null && typeof window !== 'undefined' && window._creerQueteEspIdx != null) espIdx = window._creerQueteEspIdx;
  const _esps = (typeof _pqEspacesSource === 'function') ? _pqEspacesSource() : [];
  const espNom = (espIdx != null && _esps[espIdx]) ? _esps[espIdx].nom : null;
  // Montant de graines exprimé par demi-journée et par personne.
  const grainesUnite = parseInt(val('pq-create-graines'), 10) || 50;
  // Édition d'une quête existante : on conserve son id et son statut.
  const editQ = (pqCreerEditId != null) ? PILOTE_QUETES_DEMO.find(x => x.id === pqCreerEditId) : null;
  const q = {
    id: editQ ? editQ.id : ('q-' + (window.store ? store.uuid() : Date.now().toString(36))),
    titre: titre,
    statut: editQ ? editQ.statut : 'a_verifier',
    desc: val('pq-create-desc'),
    duree: val('pq-create-duree') || '-',
    nb: val('pq-create-nb') || '-',
    graines: grainesUnite,
    grainesParDemiJour: grainesUnite,
    dateISO: datesISO[0] || null,
    datesISO: datesISO,
    competence: competence,
    impact: val('pq-create-impact'),
    materiel: lignes('pq-create-materiel'),
    plan: plan,
    preuve: val('pq-create-preuve') || 'Photos de l\'action réalisée + indicateurs mesurés.',
    icis: Array.from(document.querySelectorAll('#pq-create-icis [data-sel="1"]')).map(b => b.getAttribute('data-ici')),
    // Rattachement à l'espace (select, sinon flux guidé).
    espIdx: espIdx,
    espNom: espNom,
    source: editQ ? editQ.source : null,
    sourceIc: editQ ? (editQ.sourceIc || '⚡') : '⚡',
    custom: editQ ? (editQ.custom !== false) : true
  };
  if (editQ) {
    // Fusionne dans l'objet existant (préserve les champs non gérés par le formulaire).
    Object.assign(editQ, q);
  } else {
    PILOTE_QUETES_DEMO.push(q);
  }
  if (window.store) {
    const lieuId = (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.id) || 'lieu-demo';
    store.upsert('quetes', Object.assign({ lieu_id: lieuId }, editQ || q));
  }
  const wasEdit = !!editQ;
  piloteQueteCreerFermer();
  if (typeof renderPiloteQuetes === 'function') renderPiloteQuetes();
  // Reflète aussi la quête dans l'assistant de création (guidé comme libre).
  if (typeof creerStep3RefreshQuetes === 'function') creerStep3RefreshQuetes();
  if (typeof creerRefreshSidebar === 'function') { try { creerRefreshSidebar(); } catch (e) {} }
  if (typeof creerMapRevealRefresh === 'function') { try { creerMapRevealRefresh(); } catch (e) {} }
  if (typeof mmBubble === 'function') mmBubble(wasEdit ? '💾 Quête mise à jour' : '⚡ Quête créée · vérifie-la puis publie-la pour la rendre visible');
  return true;
}

/* ─── Détection automatique du type de convergence ─── */
function detectConvType(titre, impact) {
  const t = (titre + ' ' + impact).toLowerCase();
  if (/repair|répar|fablab|fab.?lab|réemploi|reemploi|objet/.test(t))          return 'repair';
  if (/jardin|maraîchage|permaculture|potager|serre|cultiv|végétal|kg.*an/.test(t)) return 'jardin';
  if (/solaire|photovoltaïque|pv|thermique|chauffe.eau|kwh|énergie|audit.én/.test(t)) return 'energie_solaire';
  if (/isolation|paille|construction|biosourcé|rénov|chauffage/.test(t))        return 'isolation';
  if (/compost|déchet|biodéchet|tri|gaspillage/.test(t))                         return 'compostage';
  if (/biodiversité|haie|mare|plantation|espèce|faune|flore/.test(t))            return 'biodiversite';
  if (/gouvernance|assemblée|token|graines.local|décision|collectif/.test(t))    return 'gouvernance';
  if (/atelier|formation|stage|transmi|enseign|savoir.faire/.test(t))            return 'atelier';
  if (/coworking|bureau|télétravail/.test(t))                                    return 'coworking';
  if (/mobilité|vélo|déplacement/.test(t))                                       return 'mobilite';
  return null;
}

/* ─── Extraction des valeurs depuis nb + impact ─── */
function parseQueteValues(quete) {
  // val1 = nombre de personnes (moyenne de la fourchette)
  const nbMatch = (quete.nb || '').match(/(\d+)[\s–-]*(\d+)?/);
  const nbMin = nbMatch ? parseInt(nbMatch[1]) : 3;
  const nbMax = nbMatch && nbMatch[2] ? parseInt(nbMatch[2]) : nbMin;
  const val1  = Math.round((nbMin + nbMax) / 2);

  // val2 = valeur chiffrée extraite de l'impact
  const valMatch = (quete.impact || '').match(/[~−\-]?(\d[\d\s]*[\d,.]?\d*)/);
  const val2 = valMatch ? parseFloat(valMatch[1].replace(/\s/g, '').replace(',', '.')) : val1;

  return { val1, val2 };
}

/* ─── Rendu des badges de convergence pour une quête ─── */
function renderQueteConvBadges(quete) {
  const type = detectConvType(quete.titre, quete.impact);
  if (!type) return '';
  const m = CONVERGENCE_MATRIX[type];
  if (!m) return '';
  const { val1, val2 } = parseQueteValues(quete);
  const conv = convergeEntry(type, val1, val2);
  if (!conv) return '';

  const BADGE_CLS = { ESRS:'esrs', ODD:'odd', PCAET:'pcaet', FSE_PLUS:'fse', ADEME:'ademe', BPI:'bpi', ESS:'bpi', NOTRe:'pcaet' };
  const badges = Object.keys(conv).map(k =>
    `<span class="conv-badge ${BADGE_CLS[k]||'esrs'}" title="${k}">${k==='FSE_PLUS'?'FSE+':k==='NOTRe'?'NOTRe':k}</span>`
  ).join('');

  // Indicateur clé mis en avant
  const esrs = conv.ESRS ? Object.entries(conv.ESRS)[0] : null;
  const kpi  = esrs ? `<span style="font-size:.6rem;color:var(--fern);font-weight:600;margin-left:.4rem">→ ${Math.round(esrs[1].val)} ${esrs[1].unite}</span>` : '';

  return `<div class="conv-badge-row" style="margin-top:.4rem">${badges}${kpi}</div>`;
}

/* ─── Rendu de la liste des quêtes dans le panel Pilote ─── */
// ── Suivi d'une quête : agrégats réels (inscrits, demandes, preuves) ──
function _pqStats(qid) {
  let inscrits = 0, preuvesDep = 0, preuvesAValider = 0, enAttente = [];
  if (window.store && qid != null) {
    inscrits = store.where('quete_candidatures', c => c && c.statut === 'inscrit' && c.quete_id === qid).length;
    enAttente = store.where('quete_candidatures', c => c && c.statut === 'en_attente' && c.quete_id === qid);
    const pr = store.where('quete_preuves', p => p && p.quete_id === qid);
    preuvesDep = pr.length;
    preuvesAValider = pr.filter(p => !p.validee).length;
  }
  return { inscrits, preuvesDep, preuvesAValider, enAttente };
}

// Validation d'un bâtisseur en attente → il rejoint l'équipe de la quête.
function piloteValiderBatisseur(candId) {
  if (!window.store || !candId) return;
  const c = store.get('quete_candidatures', candId);
  if (!c) return;
  store.update('quete_candidatures', candId, { statut: 'inscrit' });
  if (typeof mmBubble === 'function') mmBubble('✅ ' + (c.batisseur_nom || 'Le bâtisseur') + ' a rejoint la quête');
  renderPiloteQuetes();
}
// Refus d'une demande (statut « refuse » : propagé en base, exclu des requêtes).
function piloteRefuserBatisseur(candId) {
  if (!window.store || !candId) return;
  const c = store.get('quete_candidatures', candId);
  store.update('quete_candidatures', candId, { statut: 'refuse' });
  if (typeof mmBubble === 'function') mmBubble('Demande de ' + ((c && c.batisseur_nom) || 'bâtisseur') + ' déclinée');
  renderPiloteQuetes();
}
// Cible de participants extraite d'un libellé libre ("2–4 pers." → 4).
function _pqTargetNb(nbStr) {
  const nums = String(nbStr == null ? '' : nbStr).match(/\d+/g);
  return (nums && nums.length) ? Math.max.apply(null, nums.map(Number)) : null;
}
// Date de rencontre → libellé relatif ("aujourd'hui", "dans 3 j", "passée").
function _pqDateInfo(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  const long = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  let rel, urgent = false, past = false;
  if (diff < 0) { rel = 'passée'; past = true; }
  else if (diff === 0) { rel = "aujourd'hui"; urgent = true; }
  else if (diff === 1) { rel = 'demain'; urgent = true; }
  else if (diff <= 7) { rel = 'dans ' + diff + ' j'; urgent = true; }
  else rel = long;
  return { iso: dateISO, long: long, rel: rel, urgent: urgent, past: past, diff: diff };
}

function renderPiloteQuetes() {
  const container = document.getElementById('pilote-quetes-list');
  if (!container) return;

  // État vierge si aucune quête
  if (PILOTE_QUETES_DEMO.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:2.5rem 1rem;color:var(--moss)">
        <div style="font-size:2rem;margin-bottom:.75rem">⚡</div>
        <div style="font-size:.82rem;font-weight:700;color:var(--ink);margin-bottom:.35rem">Aucune quête pour l'instant</div>
        <div style="font-size:.7rem;opacity:.75;line-height:1.55;max-width:360px;margin:0 auto">Commence par « <b>+ Nouvelle quête</b> » : décris une action concrète de ton lieu, publie-la, et les bâtisseurs pourront la rejoindre.</div>
      </div>`;
    const stats = document.querySelectorAll('#pilote-panel-quetes .lq-stat-val');
    if (stats[0]) stats[0].textContent = '0';
    if (stats[2]) stats[2].textContent = '0';
    if (stats[3]) stats[3].textContent = '-';
    return;
  }

  const nbDossiers = 8;
  const isVal = (id) => (typeof quetesValidees !== 'undefined') && quetesValidees.has(id);

  const F = (typeof piloteQueteFilter !== 'undefined') ? piloteQueteFilter : 'toutes';
  const aVerifier = PILOTE_QUETES_DEMO.filter(q => q.statut === 'a_verifier');
  const enLigne   = PILOTE_QUETES_DEMO.filter(q => q.statut === 'ouverte' || q.statut === 'terminee');
  const enPause   = PILOTE_QUETES_DEMO.filter(q => q.statut === 'en_pause');
  // Sections affichées selon le filtre actif. Une quête est « terminée » si son
  // statut persistant le dit (base) ou si elle vient d'être validée (session).
  const estTerminee = (q) => q.statut === 'terminee' || isVal(q.id);
  const enLigneActives = enLigne.filter(q => !estTerminee(q));   // publiées, non terminées
  const terminees      = enLigne.filter(estTerminee);            // validées / propagées
  const showAverif    = (F === 'toutes' || F === 'a_publier');
  const showOuvertes  = (F === 'toutes' || F === 'ouvertes');
  const showTerminees = (F === 'toutes' || F === 'terminees');

  const card = (q) => {
    const estAVerif  = q.statut === 'a_verifier';
    const estPause   = q.statut === 'en_pause';
    const estValidee = !estAVerif && !estPause && (q.statut === 'terminee' || isVal(q.id));
    // Suivi : inscrits / preuves + date de rencontre.
    const st = _pqStats(q.id);
    const di = _pqDateInfo(q.dateISO);
    const target = _pqTargetNb(q.nb);
    const pct = target ? Math.min(100, Math.round(st.inscrits / target * 100)) : (st.inscrits > 0 ? 100 : 0);
    // Barre de progression (masquée pour les quêtes pas encore publiées).
    const progressHtml = estAVerif ? '' : `
        <div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin:.55rem 0 .1rem">
          <div style="flex:1;min-width:130px">
            <div style="display:flex;justify-content:space-between;font-size:.58rem;color:var(--moss);margin-bottom:.22rem"><span>👥 Inscrits</span><span style="font-weight:800;color:var(--ink)">${st.inscrits}${target ? ' / ' + target : ''}</span></div>
            <div style="height:4px;background:rgba(46,102,66,.1);border-radius:100px;overflow:hidden"><div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#4a8c5c,#82b894);border-radius:100px"></div></div>
          </div>
          ${st.preuvesDep ? `<span style="font-size:.6rem;color:var(--moss)">✅ ${st.preuvesDep} preuve${st.preuvesDep > 1 ? 's' : ''}</span>` : ''}
          ${st.preuvesAValider ? `<button onclick="openPiloteQueteFiche('${q.id}')" style="font-size:.6rem;font-weight:700;color:#8a4a1a;background:rgba(200,115,42,.12);border:1px solid rgba(200,115,42,.3);border-radius:100px;padding:.15rem .5rem;cursor:pointer">🕓 ${st.preuvesAValider} à valider →</button>` : ''}
        </div>`;
    // Bâtisseurs en attente : le Pilote valide (rejoint l'équipe) ou décline.
    const pend = st.enAttente || [];
    const validerHtml = (estAVerif || !pend.length) ? '' : `
        <div style="margin:.5rem 0 .1rem;background:rgba(200,115,42,.06);border:1px solid rgba(200,115,42,.2);border-radius:var(--r)">
          <div style="font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:#8a4a1a;padding:.45rem .6rem .2rem">👋 ${pend.length} bâtisseur${pend.length > 1 ? 's' : ''} à valider</div>
          ${pend.map(c => `<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;padding:.3rem .6rem;border-top:1px solid rgba(200,115,42,.12)">
            <span style="font-size:.7rem;color:var(--ink);font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.batisseur_nom || 'Bâtisseur'}</span>
            <span style="display:flex;gap:.35rem;flex-shrink:0">
              <button onclick="piloteValiderBatisseur('${c.id}')" style="font-size:.62rem;font-weight:700;color:white;background:var(--forest);border:0;border-radius:100px;padding:.28rem .7rem;cursor:pointer">✓ Valider</button>
              <button onclick="piloteRefuserBatisseur('${c.id}')" style="font-size:.62rem;color:var(--moss);background:transparent;border:1px solid rgba(46,102,66,.2);border-radius:100px;padding:.28rem .55rem;cursor:pointer" title="Décliner">✕</button>
            </span>
          </div>`).join('')}
        </div>`;
    const statutHtml = estAVerif
      ? `<span class="pq-status a-verifier">🕓 À vérifier</span>`
      : estPause
        ? `<span class="pq-status a-verifier">⏸ En pause</span>`
        : estValidee
          ? `<span class="pq-status validee">✓ Propagée</span>`
          : `<span class="pq-status ouverte">🟢 En ligne</span>`;
    const editBtn = `<button class="btn btn-ghost" style="font-size:.72rem;padding:.5rem .9rem" onclick="piloteQueteCreerOuvrir('${q.id}')">✏️ Modifier</button>`;
    const actions = estAVerif
      ? `<button class="btn btn-primary" style="font-size:.74rem;font-weight:700;padding:.5rem 1.1rem" onclick="piloteQuetePublier('${q.id}')">✓ Publier</button>
         ${editBtn}
         <button class="btn btn-ghost" style="font-size:.7rem;padding:.5rem .8rem;color:var(--moss);opacity:.65" onclick="piloteQueteRetirer('${q.id}')">✕ Retirer</button>`
      : estPause
        ? `<button class="btn btn-primary" style="font-size:.74rem;font-weight:700;padding:.5rem 1.1rem" onclick="piloteQueteReactiver('${q.id}')">▶️ Réactiver</button>
           ${editBtn}
           <span style="font-size:.62rem;color:var(--moss);opacity:.7;margin-left:.2rem">Retirée du réseau</span>`
        : `<button class="btn btn-ghost" style="font-size:.74rem;padding:.5rem 1.1rem" onclick="openPiloteQueteFiche('${q.id}')">Voir détail →</button>
         ${editBtn}
         ${estValidee ? `<span class="pq-propag-badge visible">✦ ${nbDossiers} dossiers mis à jour</span>` : `<span style="font-size:.62rem;color:var(--fern);font-weight:600;margin-left:.2rem">✓ Visible par les bâtisseurs</span>`}`;
    return `
      <div class="pq-card" id="pq-${q.id}" style="${estAVerif || estPause ? 'border-left:3px solid var(--amber)' : ''}${estPause ? ';opacity:.9' : ''}${estValidee ? ';opacity:.78' : ''}">
        <div class="pq-card-top">
          <div class="pq-card-title">${q.titre}</div>
          ${statutHtml}
        </div>
        <div class="pq-card-meta">
          <span>⏱ ${q.duree}</span>
          <span>👥 ${q.nb}</span>
          <span>🌱 ${q.graines} graines${q.grainesParDemiJour ? ' /½j·pers' : ''}</span>
          ${di ? `<span style="color:${di.urgent ? 'var(--amber)' : 'var(--moss)'};font-weight:${di.urgent ? '700' : '400'}">📅 ${di.rel}</span>` : ''}
          <span style="color:var(--fern);font-weight:600">${(q.impact || '').split('·')[0].trim()}</span>
        </div>
        ${progressHtml}
        ${validerHtml}
        <div class="pq-actions">${actions}
          <button class="btn btn-ghost" style="font-size:.68rem;padding:.5rem .7rem;color:var(--terracotta);margin-left:auto" onclick="piloteQueteSupprimer('${q.id}')" title="Supprimer définitivement (efface de la base)">🗑 Supprimer</button>
        </div>
      </div>`;
  };

  // Regroupe une liste de quêtes par espace (index croissant, « Autres » en fin)
  // et rend chaque groupe précédé d'un sous-titre d'espace.
  const groupByEspace = (list) => {
    const groups = new Map();
    list.forEach(q => {
      const key = (q.espIdx != null) ? q.espIdx : 'autres';
      if (!groups.has(key)) groups.set(key, { nom: q.espNom || (key === 'autres' ? 'Autres quêtes' : ('Espace ' + (key + 1))), items: [] });
      groups.get(key).items.push(q);
    });
    return Array.from(groups.entries())
      .sort((a, b) => (a[0] === 'autres') ? 1 : (b[0] === 'autres') ? -1 : (a[0] - b[0]))
      .map(([, g]) =>
        `<div style="font-size:.62rem;font-weight:800;color:var(--fern);text-transform:uppercase;letter-spacing:.05em;margin:.7rem 0 .45rem;padding-left:.1rem">📍 ${g.nom} · ${g.items.length}</div>`
        + g.items.map(card).join('')
      ).join('');
  };

  const sectionTitle = (txt, mt) => `<div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--moss);opacity:.65;margin:${mt} 0 .55rem">${txt}</div>`;

  // ── Vue Agenda : quêtes triées par date de rencontre, groupées par échéance ──
  const agendaHtml = (list) => {
    const withDate = list.filter(q => q.dateISO);
    const noDate   = list.filter(q => !q.dateISO);
    const sorted = withDate.slice().sort((a, b) => a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : 0);
    const buckets = [
      { nom: '⚠️ Date passée',   test: di => di.past },
      { nom: '🔥 Cette semaine', test: di => !di.past && di.diff <= 7 },
      { nom: '📆 Plus tard',      test: di => !di.past && di.diff > 7 },
    ];
    let out = '';
    buckets.forEach(bk => {
      const items = sorted.filter(q => bk.test(_pqDateInfo(q.dateISO)));
      if (items.length) out += sectionTitle(bk.nom + ' · ' + items.length, out ? '1.1rem' : '.2rem') + items.map(card).join('');
    });
    if (noDate.length) out += sectionTitle('🗓 Sans date · ' + noDate.length, out ? '1.1rem' : '.2rem') + noDate.map(card).join('');
    return out;
  };

  // Liste filtrée (utilisée par les vues Agenda et le filtre « À traiter »).
  // « À traiter » = preuve à valider OU bâtisseur en attente de validation.
  const _pqNeedsAction = q => { const s = _pqStats(q.id); return s.preuvesAValider > 0 || (s.enAttente && s.enAttente.length > 0); };
  const filteredList =
      F === 'a_publier' ? aVerifier.slice()
    : F === 'ouvertes'  ? enLigneActives.concat(enPause)
    : F === 'terminees' ? terminees.slice()
    : F === 'a_traiter' ? aVerifier.concat(enLigne.filter(_pqNeedsAction))
    : PILOTE_QUETES_DEMO.slice();

  const emptyMsg = (F === 'a_traiter')
    ? `<div style="text-align:center;padding:2.2rem 1rem;color:var(--moss)"><div style="font-size:1.6rem;margin-bottom:.6rem">🎉</div><div style="font-size:.78rem;font-weight:700;color:var(--ink)">Rien à traiter pour l'instant</div><div style="font-size:.7rem;opacity:.75;margin-top:.3rem">Aucune preuve à valider, aucun bâtisseur en attente, aucune quête à publier.</div></div>`
    : (() => {
        const labels = { a_publier: 'à publier', ouvertes: 'ouverte', terminees: 'terminée' };
        return `<div style="text-align:center;padding:2.2rem 1rem;color:var(--moss)">
          <div style="font-size:1.6rem;margin-bottom:.6rem">⚡</div>
          <div style="font-size:.78rem;font-weight:700;color:var(--ink);margin-bottom:.3rem">Aucune quête ${labels[F] || ''} pour l'instant</div>
          ${F === 'toutes' ? `<div style="font-size:.7rem;opacity:.75;line-height:1.55;max-width:360px;margin:0 auto">Commence par « <b>+ Nouvelle quête</b> » : décris une action concrète de ton lieu, publie-la, et les bâtisseurs pourront la rejoindre.</div>` : ''}
        </div>`;
      })();

  // ── Zone « À traiter » : centralise ce qui demande une action du Pilote ──
  let totInscrits = 0, totPreuves = 0, totAValiderBat = 0;
  PILOTE_QUETES_DEMO.forEach(q => { const s = _pqStats(q.id); totInscrits += s.inscrits; totPreuves += s.preuvesAValider; totAValiderBat += (s.enAttente ? s.enAttente.length : 0); });
  const totAPublier = aVerifier.length;
  const _chip = (bg, bd, col) => `background:${bg};border:1px solid ${bd};color:${col};border-radius:100px;padding:.3rem .75rem;font-size:.66rem;font-weight:700;cursor:pointer`;
  const aTraiterZone = (totPreuves || totAPublier || totAValiderBat) ? `
    <div style="background:linear-gradient(135deg,rgba(200,115,42,.07),rgba(74,140,92,.06));border:1px solid rgba(200,115,42,.2);border-radius:var(--r-lg);padding:.7rem .9rem;margin-bottom:.9rem">
      <div style="font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#8a4a1a;margin-bottom:.5rem">🎯 À traiter</div>
      <div style="display:flex;flex-wrap:wrap;gap:.4rem;align-items:center">
        ${totAValiderBat ? `<button onclick="document.getElementById('lqf-a-traiter').click()" style="${_chip('rgba(200,115,42,.12)', 'rgba(200,115,42,.3)', '#8a4a1a')}">👋 ${totAValiderBat} bâtisseur${totAValiderBat > 1 ? 's' : ''} à valider →</button>` : ''}
        ${totPreuves ? `<button onclick="document.getElementById('lqf-a-traiter').click()" style="${_chip('rgba(200,115,42,.12)', 'rgba(200,115,42,.3)', '#8a4a1a')}">🕓 ${totPreuves} preuve${totPreuves > 1 ? 's' : ''} à valider →</button>` : ''}
        ${totAPublier ? `<button onclick="document.getElementById('lqf-a-publier').click()" style="${_chip('rgba(74,140,92,.12)', 'rgba(74,140,92,.3)', 'var(--forest)')}">🟢 ${totAPublier} à publier →</button>` : ''}
        ${totInscrits ? `<span style="font-size:.66rem;color:var(--moss);font-weight:600">👋 ${totInscrits} inscrit${totInscrits > 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>` : '';

  let html = aTraiterZone;
  if (piloteQueteView === 'agenda') {
    const body = agendaHtml(filteredList);
    html += body || emptyMsg;
  } else if (F === 'a_traiter') {
    html += filteredList.length ? (sectionTitle('🎯 À traiter · ' + filteredList.length, '.2rem') + groupByEspace(filteredList)) : emptyMsg;
  } else {
    let body = '';
    if (showAverif && aVerifier.length)       { body += sectionTitle('🕓 À vérifier · ' + aVerifier.length, body ? '1.1rem' : '.2rem') + groupByEspace(aVerifier); }
    if (showOuvertes && enLigneActives.length) { body += sectionTitle('🟢 En ligne · ' + enLigneActives.length, body ? '1.1rem' : '.2rem') + groupByEspace(enLigneActives); }
    if (showTerminees && terminees.length)    { body += sectionTitle('✓ Terminées · ' + terminees.length, body ? '1.1rem' : '.2rem') + groupByEspace(terminees); }
    if ((F === 'toutes' || F === 'ouvertes') && enPause.length) { body += sectionTitle('⏸ En pause · ' + enPause.length, body ? '1.1rem' : '.2rem') + groupByEspace(enPause); }
    html += body || emptyMsg;
  }
  container.innerHTML = html;

  // Stats KPI : « actives » = quêtes en ligne non terminées
  const nbTerminees = terminees.length;
  const totalGraines = terminees.reduce((s, q) => s + (q.graines || 0), 0);
  const stats = document.querySelectorAll('#pilote-panel-quetes .lq-stat-val');
  if (stats[0]) stats[0].textContent = enLigneActives.length;
  // Bâtisseurs impliqués : inscrits distincts sur les quêtes du lieu
  // (table quete_candidatures) : la stat n'était jamais renseignée.
  if (stats[1]) {
    let nbBats = 0;
    if (window.store) {
      const qids = new Set(PILOTE_QUETES_DEMO.map(q => q.id));
      const bset = new Set();
      store.where('quete_candidatures', c => c.statut === 'inscrit' && qids.has(c.quete_id))
        .forEach(c => bset.add(c.batisseur_id || c.id));
      nbBats = bset.size;
    }
    stats[1].textContent = nbBats || '-';
  }
  if (stats[2]) stats[2].textContent = nbTerminees;
  if (stats[3]) stats[3].textContent = totalGraines || '-';

  // Notifications : preuves à valider + bâtisseurs en attente de validation.
  let nbPreuvesAttente = 0, nbBatAttente = 0;
  if (window.store) {
    const qidSet = new Set(PILOTE_QUETES_DEMO.map(q => q.id));
    nbPreuvesAttente = store.where('quete_preuves', p => p && !p.validee && qidSet.has(p.quete_id)).length;
    nbBatAttente = store.where('quete_candidatures', c => c && c.statut === 'en_attente' && qidSet.has(c.quete_id)).length;
  }
  // Point orange sur l'onglet Quêtes tant qu'une action attend le Pilote.
  const nbNotif = nbPreuvesAttente + nbBatAttente;
  const tabBtn = document.getElementById('ptab-quetes');
  if (tabBtn) {
    const dot = tabBtn.querySelector('.notif-dot');
    if (nbNotif > 0 && !dot) {
      const d = document.createElement('span');
      d.className = 'notif-dot';
      d.style.cssText = 'display:inline-block;width:7px;height:7px;background:var(--amber);border-radius:50%;margin-left:.35rem;vertical-align:middle';
      tabBtn.appendChild(d);
    } else if (!nbNotif && dot) dot.remove();
  }

  // Répercute sur l'aperçu (Vadance + wallet graines)
  if (typeof updateApercuFromQuetes === 'function') updateApercuFromQuetes();
}

/* ─── Vérification → mise en ligne des quêtes (le Pilote publie quête par quête) ─── */
function piloteQuetePublier(id) {
  const q = PILOTE_QUETES_DEMO.find(x => x.id === id); if (!q) return;
  q.statut = 'ouverte';
  if (window.store) _quetePublierStore(id, q);
  if (typeof mmBubble === 'function') mmBubble('🟢 Quête publiée · désormais visible par les bâtisseurs');
  renderPiloteQuetes();
}
// Publie dans le store en résistant à une ligne manquante : si l'update ne
// trouve rien (store.update renvoie null), on recrée la ligne complète au lieu
// d'afficher « publiée » sans avoir rien écrit.
function _quetePublierStore(id, q) {
  const r = store.update('quetes', id, { statut: 'ouverte' });
  if (!r) {
    const lieuId = (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.id) || null;
    store.upsert('quetes', Object.assign({}, q, { id: id, lieu_id: lieuId, statut: 'ouverte' }));
  }
}
// Suppression DÉFINITIVE d'une quête : efface la ligne locale + Supabase
// (lieu_quetes). Pour une quête dérivée d'une solution, on marque la solution
// comme retirée pour qu'elle ne soit pas re-générée (ni re-poussée).
function piloteQueteSupprimer(id) {
  const q = PILOTE_QUETES_DEMO.find(x => x.id === id);
  const titre = (q && q.titre) || 'cette quête';
  if (typeof confirm === 'function' && !confirm('Supprimer définitivement « ' + titre + ' » ?\nElle sera effacée de la base (action irréversible).')) return;

  // Empêche la régénération d'une quête issue d'une solution retenue.
  if (q && !q.custom && q.source && typeof myLieuData !== 'undefined' && myLieuData) {
    const key = 'sol:' + q.source;
    const list = Array.isArray(myLieuData.quetesRetirees) ? myLieuData.quetesRetirees.slice() : [];
    if (list.indexOf(key) < 0) list.push(key);
    myLieuData.quetesRetirees = list;
    if (window.store && myLieuData.id) { try { store.update('lieux', myLieuData.id, { quetesRetirees: list }); } catch (e) {} }
  }

  if (window.store) {
    try { store.remove('quetes', id); } catch (e) {}                 // local
    if (typeof store.deleteQueteRemote === 'function') store.deleteQueteRemote(id); // Supabase
  }
  const i = PILOTE_QUETES_DEMO.findIndex(x => x.id === id);
  if (i >= 0) PILOTE_QUETES_DEMO.splice(i, 1);
  if (typeof quetesValidees !== 'undefined') quetesValidees.delete(id);

  if (typeof mmBubble === 'function') mmBubble('🗑 Quête supprimée définitivement');
  renderPiloteQuetes();
  if (typeof evadRefreshCarteCompteurs === 'function') { try { evadRefreshCarteCompteurs(); } catch (e) {} }
}

function piloteQueteRetirer(id) {
  const q = PILOTE_QUETES_DEMO.find(x => x.id === id); if (!q) return;
  const wasPublished = q.statut === 'ouverte';
  q.statut = 'retiree';
  if (window.store) {
    store.update('quetes', id, { statut: 'retiree' });   // reste local (non poussé)
    // Si elle était publiée, on la retire aussi de Supabase (donc du réseau).
    if (wasPublished && typeof store.deleteQueteRemote === 'function') store.deleteQueteRemote(id);
  }
  if (typeof mmBubble === 'function') mmBubble('Quête retirée des propositions');
  renderPiloteQuetes();
}
// Réactiver une quête en pause : re-publiée sur le réseau (réinscrite en base).
function piloteQueteReactiver(id) {
  const q = PILOTE_QUETES_DEMO.find(x => x.id === id); if (!q) return;
  q.statut = 'ouverte';
  if (window.store) store.update('quetes', id, { statut: 'ouverte', paused: false });
  if (typeof mmBubble === 'function') mmBubble('▶️ Quête réactivée · de nouveau visible sur le réseau');
  renderPiloteQuetes();
}
function piloteQuetesPublierToutes() {
  let n = 0;
  PILOTE_QUETES_DEMO.forEach(q => {
    if (q.statut === 'a_verifier') { q.statut = 'ouverte'; if (window.store) _quetePublierStore(q.id, q); n++; }
  });
  if (typeof mmBubble === 'function') mmBubble('🟢 ' + n + ' quête' + (n > 1 ? 's' : '') + ' publiée' + (n > 1 ? 's' : '') + ' · visibles par les bâtisseurs');
  renderPiloteQuetes();
}

/* ─── Validation d'une quête → propagation dans actionsTerrains ─── */
function validerQuete(id) {
  const quete = PILOTE_QUETES_DEMO.find(q => q.id === id);
  if (!quete || quetesValidees.has(id)) return;

  // Preuve déposée par le Pilote (type + note), consommée une fois.
  const pv = window._pendingPreuve || null;
  window._pendingPreuve = null;

  // Gain visible : points REGEN + graines de la quête
  const _pts = (String(quete.impact || '').match(/(\d+)\s*pts?/i) || [])[1] || 5;
  if (typeof mmBubble === 'function') mmBubble(`✓ Preuve déposée · +${_pts} pts Vadité · +${quete.graines || 0} graines 🌱`);

  const type = detectConvType(quete.titre, quete.impact);
  if (!type) {
    // Pas d'équivalent dans la matrice : on enregistre quand même la preuve au journal.
    actionsTerrains.push({
      type: 'autre',
      label: quete.titre,
      val1: '', val2: '',
      date: new Date().toISOString().split('T')[0],
      source: 'quete',
      quete_id: id,
      preuve: pv
    });
    quetesValidees.add(id);
    renderPiloteQuetes();
    return;
  }

  const { val1, val2 } = parseQueteValues(quete);
  const conv = convergeEntry(type, val1, val2);
  const m    = CONVERGENCE_MATRIX[type];

  // Ajoute à actionsTerrains pour les dossiers
  actionsTerrains.push({
    type,
    label: quete.titre,
    val1, val2,
    date: new Date().toISOString().split('T')[0],
    convergence: conv,
    source: 'quete',
    quete_id: id,
    preuve: pv
  });

  quetesValidees.add(id);
  renderPiloteQuetes();

  // Résumé de ce qui a été propagé
  const cadresList = Object.keys(conv).map(k => k === 'FSE_PLUS' ? 'FSE+' : k).join(' · ');
  const esrsKeys   = conv.ESRS ? Object.keys(conv.ESRS).join('+') : '';

  mmBubble(`✦ "${quete.titre.substring(0,35)}…" → propagée dans ${Object.keys(conv).length} cadres (${esrsKeys ? esrsKeys+' · ' : ''}${cadresList.split(' · ').slice(0,3).join(' · ')}…)`);

  // Rafraîchit les panels si visibles
  setTimeout(() => {
    if (document.getElementById('pilote-panel-dossiers')?.classList.contains('active')) {
      initDossiers();
    }
    // Notif sur l'onglet Dossiers
    const dossBtn = document.getElementById('ptab-dossiers');
    if (dossBtn && !dossBtn.querySelector('.notif-dot')) {
      const dot = document.createElement('span');
      dot.className = 'notif-dot';
      dot.style.cssText = 'display:inline-block;width:7px;height:7px;background:var(--amber);border-radius:50%;margin-left:.35rem;vertical-align:middle';
      dossBtn.appendChild(dot);
    }
  }, 300);
}

/* ─── Init quêtes quand on ouvre le panel ─── */

/* ═══════════════════════════════════════════════════════
   FIN QUÊTES × PERMA-COMPTABILITÉ
   ═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────
   1. MATRICE DE CONVERGENCE
   Pour chaque type d'action terrain :
   - units     : unités de mesure (label1, label2)
   - par unité : vecteur de contributions par cadre
   ───────────────────────────────────────────────────────── */
const CONVERGENCE_MATRIX = {

  atelier: {
    label: 'Atelier / Formation',
    units: { u1: 'personnes', u2: 'heures' },
    calc: (nb_pers, nb_h) => ({
      ESRS: {
        'S1': { val: nb_pers, unite: 'personnes formées', label: 'Main-d\'œuvre & conditions', auditable: true },
        'S2': { val: nb_pers, unite: 'bénéficiaires communauté', label: 'Travailleurs dans la chaîne de valeur', auditable: false }
      },
      ODD: {
        '4 Éducation': { val: nb_pers, unite: 'bénéficiaires' },
        '11 Villes durables': { val: nb_pers, unite: 'citoyens engagés' },
        '17 Partenariats': { val: 1, unite: 'action collective' }
      },
      PCAET: { axe: 'Sensibilisation & sobriété', val: nb_pers, unite: 'personnes sensibilisées', action: 'Changement de comportement' },
      FSE_PLUS: { axe: 'Inclusion & compétences', val: nb_pers, unite: 'participants', heures: nb_pers * nb_h },
      ADEME: { programme: 'Éducation à l\'environnement', val: nb_pers, unite: 'bénéficiaires EE' },
      BPI: { critere: 'Innovation sociale', val: nb_pers, unite: 'bénéficiaires' },
      ESS: { critere: 'Utilité sociale démontrée', val: nb_pers, unite: 'bénéficiaires directs' },
      NOTRe: { competence: 'Formation professionnelle & apprentissage', val: nb_pers * nb_h, unite: 'heures stagiaires' }
    })
  },

  coworking: {
    label: 'Espace de coworking',
    units: { u1: 'postes', u2: 'jours/mois' },
    calc: (nb_postes, nb_jours) => ({
      ESRS: {
        'S1': { val: nb_postes, unite: 'travailleurs indépendants accueillis', label: 'Conditions de travail', auditable: true },
        'E1': { val: Math.round(nb_postes * nb_jours * 0.8), unite: 'kgCO₂ évités (trajets domicile-travail)', label: 'Réduction émissions GES', auditable: false }
      },
      ODD: {
        '8 Travail décent': { val: nb_postes, unite: 'emplois soutenus' },
        '11 Villes durables': { val: Math.round(nb_postes * nb_jours * 0.8), unite: 'kgCO₂ évités mobilité' },
        '9 Industrie & innovation': { val: nb_postes, unite: 'entrepreneurs accueillis' }
      },
      PCAET: { axe: 'Mobilité décarbonée', val: Math.round(nb_postes * nb_jours * 0.8), unite: 'kgCO₂ évités', action: 'Réduction déplacements domicile-travail' },
      FSE_PLUS: { axe: 'Emploi & entrepreneuriat', val: nb_postes, unite: 'travailleurs indépendants soutenus' },
      ADEME: { programme: 'Mobilité durable', val: Math.round(nb_postes * nb_jours * 0.8), unite: 'kgCO₂ évités/mois' },
      BPI: { critere: 'Développement économique territorial', val: nb_postes, unite: 'emplois locaux soutenus' },
      ESS: { critere: 'Développement local', val: nb_postes, unite: 'acteurs ESS accueillis' },
      NOTRe: { competence: 'Développement économique & emploi', val: nb_postes, unite: 'emplois locaux maintenus' }
    })
  },

  energie_solaire: {
    label: 'Énergie solaire (PV ou thermique)',
    units: { u1: 'kWh/an produits', u2: 'm² panneaux' },
    calc: (kwh, m2) => ({
      ESRS: {
        'E1': { val: Math.round(kwh * 0.057), unite: 'kgCO₂ évités/an (Scope 2)', label: 'Changement climatique', auditable: true },
        'E5': { val: kwh, unite: 'kWh ENR autoproduits', label: 'Utilisation des ressources & économie circulaire', auditable: true }
      },
      ODD: {
        '7 Énergie propre': { val: kwh, unite: 'kWh ENR' },
        '13 Action climatique': { val: Math.round(kwh * 0.057), unite: 'kgCO₂ évités' },
        '11 Villes durables': { val: 1, unite: 'installation ENR locale' }
      },
      PCAET: { axe: 'Production d\'énergie renouvelable', val: kwh, unite: 'kWh ENR/an', action: 'Décarbonation Scope 2' },
      FSE_PLUS: { axe: 'Transition verte', val: Math.round(kwh * 0.057), unite: 'kgCO₂ évités' },
      ADEME: { programme: 'Décarbonation & ENR', val: kwh, unite: 'kWh ENR', co2: Math.round(kwh * 0.057) },
      BPI: { critere: 'Innovation verte', val: kwh, unite: 'kWh ENR autoproduits' },
      ESS: { critere: 'Impact environnemental', val: Math.round(kwh * 0.057), unite: 'kgCO₂ évités' },
      NOTRe: { competence: 'Transition énergétique (SRADDET/PCAET)', val: kwh, unite: 'kWh ENR locaux' }
    })
  },

  isolation: {
    label: 'Isolation / Construction biosourcée',
    units: { u1: 'm² isolés', u2: '% réduction chauffage' },
    calc: (m2, pct) => {
      const kwh_eco = Math.round(m2 * 40 * (pct / 100));
      return {
        ESRS: {
          'E1': { val: Math.round(kwh_eco * 0.057), unite: 'kgCO₂ évités/an', label: 'Réduction émissions GES', auditable: true },
          'E5': { val: m2, unite: 'm² matériaux biosourcés', label: 'Économie circulaire & ressources', auditable: true }
        },
        ODD: {
          '11 Villes durables': { val: m2, unite: 'm² rénovés' },
          '13 Action climatique': { val: Math.round(kwh_eco * 0.057), unite: 'kgCO₂ évités' },
          '12 Consommation responsable': { val: m2, unite: 'm² éco-construction' }
        },
        PCAET: { axe: 'Rénovation énergétique', val: kwh_eco, unite: 'kWh économisés/an', action: 'Efficacité énergétique bâtiment' },
        FSE_PLUS: { axe: 'Transition verte & emploi', val: m2, unite: 'm² rénovés biosourcés' },
        ADEME: { programme: 'Rénovation énergétique', val: kwh_eco, unite: 'kWh économisés', co2: Math.round(kwh_eco * 0.057) },
        BPI: { critere: 'Innovation verte / Bâtiment durable', val: m2, unite: 'm² isolés biosourcés' },
        ESS: { critere: 'Impact environnemental & social', val: m2, unite: 'm² de bâti rénové' },
        NOTRe: { competence: 'Transition énergétique & rénovation', val: kwh_eco, unite: 'kWh économisés/an' }
      };
    }
  },

  jardin: {
    label: 'Jardin / Maraîchage / Permaculture',
    units: { u1: 'm² cultivés', u2: 'kg produits/an' },
    calc: (m2, kg) => ({
      ESRS: {
        'E4': { val: m2, unite: 'm² biodiversité cultivée', label: 'Biodiversité & écosystèmes', auditable: true },
        'E1': { val: Math.round(kg * 0.5), unite: 'kgCO₂ évités (transport & intrants)', label: 'Climat', auditable: false },
        'S2': { val: kg, unite: 'kg alimentation locale produite', label: 'Chaîne de valeur', auditable: true }
      },
      ODD: {
        '2 Faim zéro': { val: kg, unite: 'kg produits locaux' },
        '15 Vie terrestre': { val: m2, unite: 'm² biodiversité' },
        '3 Bonne santé': { val: Math.round(m2 / 10), unite: 'bénéficiaires alimentation saine' }
      },
      PCAET: { axe: 'Agriculture & alimentation durables', val: Math.round(kg * 0.5), unite: 'kgCO₂ évités', action: 'Circuit court alimentaire' },
      FSE_PLUS: { axe: 'Inclusion sociale & alimentation', val: Math.round(m2 / 50), unite: 'familles bénéficiaires' },
      ADEME: { programme: 'Alimentation durable & circuits courts', val: kg, unite: 'kg alimentation locale', co2: Math.round(kg * 0.5) },
      BPI: { critere: 'Souveraineté alimentaire', val: kg, unite: 'kg production locale' },
      ESS: { critere: 'Utilité sociale - alimentation', val: Math.round(m2 / 50), unite: 'ménages bénéficiaires' },
      NOTRe: { competence: 'Agriculture & gestion foncière', val: m2, unite: 'm² en agriculture durable' }
    })
  },

  compostage: {
    label: 'Compostage collectif',
    units: { u1: 'kg biodéchets/an', u2: 'foyers concernés' },
    calc: (kg, foyers) => ({
      ESRS: {
        'E5': { val: kg, unite: 'kg déchets valorisés (économie circulaire)', label: 'Ressources & déchets', auditable: true },
        'E1': { val: Math.round(kg * 0.5), unite: 'kgCO₂ évités (évitement décharge)', label: 'Climat', auditable: false }
      },
      ODD: {
        '12 Consommation responsable': { val: kg, unite: 'kg déchets détournés' },
        '13 Action climatique': { val: Math.round(kg * 0.5), unite: 'kgCO₂ évités' },
        '15 Vie terrestre': { val: Math.round(kg * 0.3), unite: 'kg compost produit' }
      },
      PCAET: { axe: 'Déchets & économie circulaire', val: kg, unite: 'kg biodéchets valorisés', action: 'Réduction déchets ménagers' },
      FSE_PLUS: { axe: 'Environnement & gestion ressources', val: foyers, unite: 'foyers sensibilisés' },
      ADEME: { programme: 'Prévention & valorisation déchets', val: kg, unite: 'kg biodéchets valorisés', co2: Math.round(kg * 0.5) },
      BPI: { critere: 'Économie circulaire', val: kg, unite: 'kg matière valorisée' },
      ESS: { critere: 'Utilité sociale - environnement', val: foyers, unite: 'foyers concernés' },
      NOTRe: { competence: 'Gestion des déchets', val: kg, unite: 'kg biodéchets compostés localement' }
    })
  },

  repair: {
    label: 'Repair Café / FabLab',
    units: { u1: 'objets réparés', u2: 'participants' },
    calc: (objets, pers) => ({
      ESRS: {
        'E5': { val: Math.round(objets * 0.5), unite: 'kg matière détournée de décharge', label: 'Économie circulaire', auditable: true },
        'S1': { val: pers, unite: 'personnes formées compétences manuelles', label: 'Formation', auditable: true },
        'E1': { val: Math.round(objets * 2.5), unite: 'kgCO₂ évités (cycle de vie prolongé)', label: 'Climat', auditable: false }
      },
      ODD: {
        '12 Consommation responsable': { val: objets, unite: 'objets réparés (cycle vie prolongé)' },
        '4 Éducation': { val: pers, unite: 'personnes compétences manuelles' },
        '8 Travail décent': { val: Math.round(pers * 0.2), unite: 'emplois locaux réparation soutenus' }
      },
      PCAET: { axe: 'Économie circulaire & sobriété', val: Math.round(objets * 2.5), unite: 'kgCO₂ évités', action: 'Extension durée de vie produits' },
      FSE_PLUS: { axe: 'Compétences & employabilité', val: pers, unite: 'participants formés' },
      ADEME: { programme: 'Réparation & réemploi', val: objets, unite: 'objets réparés', co2: Math.round(objets * 2.5) },
      BPI: { critere: 'Économie circulaire & innovation sociale', val: objets, unite: 'objets remis en service' },
      ESS: { critere: 'Utilité sociale & lien social', val: pers, unite: 'bénéficiaires ateliers' },
      NOTRe: { competence: 'Économie circulaire', val: Math.round(objets * 0.5), unite: 'kg matériaux réemployés localement' }
    })
  },

  biodiversite: {
    label: 'Biodiversité / Végétalisation',
    units: { u1: 'm² végétalisés', u2: 'espèces plantées' },
    calc: (m2, especes) => ({
      ESRS: {
        'E4': { val: m2, unite: 'm² habitats créés/restaurés', label: 'Biodiversité & écosystèmes', auditable: true },
        'E1': { val: Math.round(m2 * 2), unite: 'kgCO₂ séquestrés/an (végétation)', label: 'Climat', auditable: false },
        'E3': { val: m2, unite: 'm² perméabilité hydraulique restaurée', label: 'Eau', auditable: false }
      },
      ODD: {
        '15 Vie terrestre': { val: m2, unite: 'm² biodiversité' },
        '13 Action climatique': { val: Math.round(m2 * 2), unite: 'kgCO₂ séquestrés' },
        '11 Villes durables': { val: m2, unite: 'm² végétalisés en milieu urbain' }
      },
      PCAET: { axe: 'Biodiversité & nature en ville', val: m2, unite: 'm² végétalisés', action: 'Trame verte & bleue' },
      FSE_PLUS: { axe: 'Environnement & biodiversité', val: especes, unite: 'espèces locales replantées' },
      ADEME: { programme: 'Biodiversité & solutions fondées sur la nature', val: m2, unite: 'm² NBS', co2: Math.round(m2 * 2) },
      BPI: { critere: 'Impact environnemental positif', val: m2, unite: 'm² renaturation' },
      ESS: { critere: 'Utilité sociale - environnement', val: m2, unite: 'm² espaces partagés renaturés' },
      NOTRe: { competence: 'Biodiversité (SRCE/TVB)', val: m2, unite: 'm² trame verte créée' }
    })
  },

  gouvernance: {
    label: 'Gouvernance participative',
    units: { u1: 'membres actifs', u2: 'décisions co-construites' },
    calc: (membres, decisions) => ({
      ESRS: {
        'G1': { val: decisions, unite: 'décisions tracées & transparentes', label: 'Conduite des affaires', auditable: true },
        'S1': { val: membres, unite: 'parties prenantes impliquées', label: 'Main-d\'œuvre', auditable: true }
      },
      ODD: {
        '16 Paix & justice': { val: decisions, unite: 'décisions participatives' },
        '17 Partenariats': { val: membres, unite: 'membres actifs réseau' },
        '10 Inégalités réduites': { val: membres, unite: 'voix représentées' }
      },
      PCAET: { axe: 'Gouvernance & mobilisation citoyenne', val: membres, unite: 'citoyens engagés', action: 'Démocratie participative locale' },
      FSE_PLUS: { axe: 'Inclusion & participation citoyenne', val: membres, unite: 'participants gouvernance' },
      ADEME: { programme: 'Engagement citoyen & concertation', val: decisions, unite: 'processus participatifs documentés' },
      BPI: { critere: 'Gouvernance responsable & transparence', val: decisions, unite: 'décisions documentées' },
      ESS: { critere: 'Gouvernance démocratique (loi Hamon)', val: membres, unite: 'membres actifs organe délibérant' },
      NOTRe: { competence: 'Démocratie locale & concertation', val: membres, unite: 'citoyens dans instances participatives' }
    })
  },

  mobilite: {
    label: 'Mobilité douce',
    units: { u1: 'trajets évités/mois', u2: 'km moyen/trajet' },
    calc: (trajets, km) => {
      const co2 = Math.round(trajets * km * 0.21);
      return {
        ESRS: {
          'E1': { val: co2, unite: 'kgCO₂ évités/mois (Scope 3)', label: 'Mobilité & déplacements', auditable: true }
        },
        ODD: {
          '11 Villes durables': { val: co2, unite: 'kgCO₂ mobilité évités' },
          '13 Action climatique': { val: co2, unite: 'kgCO₂ évités/mois' },
          '3 Bonne santé': { val: trajets, unite: 'trajets actifs (vélo/marche)' }
        },
        PCAET: { axe: 'Mobilité décarbonée', val: co2, unite: 'kgCO₂ évités/mois', action: 'Report modal voiture → mobilité douce' },
        FSE_PLUS: { axe: 'Mobilité & emploi', val: trajets, unite: 'trajets facilités mobilité douce' },
        ADEME: { programme: 'Mobilité durable', val: co2, unite: 'kgCO₂ évités', km: trajets * km },
        BPI: { critere: 'Impact environnemental mobilité', val: co2, unite: 'kgCO₂ évités/mois' },
        ESS: { critere: 'Mobilité inclusive', val: trajets, unite: 'trajets accessibles' },
        NOTRe: { competence: 'Mobilité & transports (PDU)', val: co2, unite: 'kgCO₂ évités mobilité locale' }
      };
    }
  }
};

/* ─────────────────────────────────────────────────────────
   2. CATALOGUE DES DOSSIERS INSTITUTIONNELS
   Chaque dossier agrège les indicateurs pertinents
   depuis les actions terrain
   ───────────────────────────────────────────────────────── */
const DOSSIERS_CATALOGUE = [
  {
    id: 'csrd_esrs',
    icon: '📋',
    nom: 'Rapport CSRD / ESRS',
    sub: 'Directive européenne · 50 000 entreprises concernées',
    cadres: ['ESRS'],
    couleur: 'var(--sky)',
    description: 'Rapport d\'impact conforme à la directive CSRD 2026. Chaque action terrain est automatiquement traduite en indicateurs ESRS E1–E5, S1–S4, G1–G2 avec niveau d\'auditabilité.',
    indicateurs_cles: ['E1 kgCO₂ évités', 'S1 personnes formées', 'E4 m² biodiversité', 'G1 décisions documentées'],
    valeur_economisee: 4500
  },
  {
    id: 'pcaet',
    icon: '🌡',
    nom: 'Contribution PCAET',
    sub: 'Plan Climat Air Énergie Territorial · obligation loi NOTRe',
    cadres: ['PCAET', 'NOTRe'],
    couleur: 'var(--fern)',
    description: 'Indicateurs de contribution au Plan Climat de ta collectivité. Justifie ton rôle dans la stratégie territoriale de décarbonation et de transition.',
    indicateurs_cles: ['kgCO₂ évités cumul', 'kWh ENR produits', 'm² végétalisés', 'personnes sensibilisées'],
    valeur_economisee: 2800
  },
  {
    id: 'fse_plus',
    icon: '🇪🇺',
    nom: 'Dossier FSE+',
    sub: 'Fonds Social Européen · axe inclusion & compétences',
    cadres: ['FSE_PLUS'],
    couleur: 'var(--lavender)',
    description: 'Indicateurs de résultat pour les appels à projets FSE+ 2021–2027. Participants formés, heures stagiaires, inclusion sociale, tous extraits automatiquement de tes quêtes.',
    indicateurs_cles: ['participants formés', 'heures stagiaires', 'emplois soutenus', 'bénéficiaires inclusion'],
    valeur_economisee: 3500
  },
  {
    id: 'ademe',
    icon: '♻️',
    nom: 'Dossier ADEME',
    sub: 'Appels à projets transition écologique',
    cadres: ['ADEME'],
    couleur: 'var(--terracotta)',
    description: 'Indicateurs d\'impact environnemental pour les programmes ADEME : décarbonation, ENR, déchets, biodiversité, mobilité durable.',
    indicateurs_cles: ['kgCO₂ évités total', 'kWh ENR', 'kg déchets valorisés', 'm² biodiversité'],
    valeur_economisee: 3000
  },
  {
    id: 'bpi',
    icon: '💼',
    nom: 'Dossier BPI France',
    sub: 'Innovation sociale · Prêts à impact',
    cadres: ['BPI'],
    couleur: 'var(--amber)',
    description: 'Justification d\'impact pour les dispositifs BPI France (prêt d\'honneur, aide innovation, garantie). Démontre la valeur sociale et environnementale créée.',
    indicateurs_cles: ['bénéficiaires directs', 'emplois créés/maintenus', 'kgCO₂ évités', 'kg réemploi'],
    valeur_economisee: 2000
  },
  {
    id: 'odd',
    icon: '🌍',
    nom: 'Rapport ODD / Agenda 2030',
    sub: 'Objectifs de Développement Durable ONU',
    cadres: ['ODD'],
    couleur: 'var(--moss)',
    description: 'Contribution aux 17 ODD mesurée et documentée. Utilisable pour les rapports de mécénat, les fondations, et la communication d\'impact publique.',
    indicateurs_cles: ['ODD 4 éducation', 'ODD 11 villes', 'ODD 13 climat', 'ODD 15 biodiversité'],
    valeur_economisee: 1500
  },
  {
    id: 'ess',
    icon: '🤝',
    nom: 'Agrément ESUS / Utilité sociale',
    sub: 'Loi Hamon ESS · Agrément ESUS · Mécénat',
    cadres: ['ESS'],
    couleur: 'var(--fern)',
    description: 'Démonstration de l\'utilité sociale pour l\'agrément ESUS, l\'accès au mécénat défiscalisé et aux financements ESS (France Active, Crédit Coopératif).',
    indicateurs_cles: ['bénéficiaires utilité sociale', 'gouvernance démocratique', 'missions non-lucratives', 'ancrage territorial'],
    valeur_economisee: 2500
  },
  {
    id: 'region',
    icon: '🗺',
    nom: 'Rapport territorial Région',
    sub: 'SRADDET · Contrats de territoire · FEDER',
    cadres: ['NOTRe', 'PCAET', 'FSE_PLUS'],
    couleur: 'var(--sky)',
    description: 'Synthèse multi-cadres pour les collectivités : SRADDET, FEDER, contrats de territoire. Un seul document qui répond à toutes les exigences régionales.',
    indicateurs_cles: ['emplois locaux', 'transition énergétique', 'cohésion sociale', 'biodiversité territoriale'],
    valeur_economisee: 6000
  }
];

/* ─────────────────────────────────────────────────────────
   3. STOCKAGE DES ACTIONS TERRAIN
   Alimenté en session par les validations, et RECONSTRUIT au chargement
   depuis les preuves validées en base (le journal survit au refresh).
   ───────────────────────────────────────────────────────── */
let actionsTerrains = [];

/* Entrée de journal (perma-comptabilité) pour une preuve de quête validée :
   mêmes convergences que la saisie manuelle (detectConvType + convergeEntry). */
function journalEntryFromPreuve(p, q) {
  q = q || {};
  const type = detectConvType(q.titre || '', q.impact || '');
  const meta = (typeof QD_PREUVE_META !== 'undefined' && QD_PREUVE_META[p.type]) || { ic: '📊', label: 'Mesure' };
  const ph = (typeof QD_PHASE_META !== 'undefined' && QD_PHASE_META[p.phase === 't0' ? 't0' : 't1'])
           || { ic: '✅', label: p.phase === 't0' ? 'T0' : 'T1' };
  const vals = type ? parseQueteValues(q) : { val1: '', val2: '' };
  return {
    type: type || 'autre',
    label: q.titre || 'Quête',
    val1: vals.val1, val2: vals.val2,
    date: String(p.updated_at || p.created_at || new Date().toISOString()).slice(0, 10),
    convergence: type ? convergeEntry(type, vals.val1, vals.val2) : null,
    source: 'quete', quete_id: q.id || null, preuve_id: p.id,
    preuve: {
      type: p.type, label: ph.label + ' · ' + meta.label, icon: ph.ic,
      note: [p.batisseur_nom || 'Bâtisseur', p.valeur || null, p.note || null].filter(Boolean).join(' · ')
    }
  };
}

/* Reconstruit le journal depuis la base : preuves validées des quêtes du
   lieu, dédupliquées par preuve_id (idempotent, appelable à chaque rendu). */
function rebuildJournalFromPreuves() {
  if (!window.store || typeof actionsTerrains === 'undefined') return;
  const myId = (typeof myLieuData !== 'undefined' && myLieuData && myLieuData.id) || null;
  if (!myId) return;
  const seen = new Set(actionsTerrains.map(a => a.preuve_id).filter(Boolean));
  store.where('quete_preuves', function (p) { return p && p.validee === true; }).forEach(function (p) {
    if (seen.has(p.id)) return;
    const q = p.quete_id ? store.get('quetes', p.quete_id) : null;
    if (!q || q.lieu_id !== myId) return;
    actionsTerrains.push(journalEntryFromPreuve(p, q));
    seen.add(p.id);
  });
}

/* ─────────────────────────────────────────────────────────
   4. MOTEUR DE CONVERGENCE
   convergeEntry(type, val1, val2) → vecteur tous cadres
   ───────────────────────────────────────────────────────── */
function convergeEntry(type, val1, val2) {
  const m = CONVERGENCE_MATRIX[type];
  if (!m) return null;
  return m.calc(parseFloat(val1) || 0, parseFloat(val2) || 0);
}

/* Agrège toutes les actions enregistrées par cadre */
function agregerParCadre(cadreKey) {
  const result = {};
  actionsTerrains.forEach(action => {
    const conv = action.convergence;
    if (!conv || !conv[cadreKey]) return;
    Object.entries(conv[cadreKey]).forEach(([indic, data]) => {
      if (!result[indic]) result[indic] = { ...data, sources: [] };
      else result[indic].val = (result[indic].val || 0) + (data.val || 0);
      result[indic].sources.push(action.label || action.type);
    });
  });
  return result;
}

/* Calcule le % de complétude d'un dossier (indicateurs renseignés) */
function calculCompletude(dossier) {
  if (actionsTerrains.length === 0) return 0;
  const cadresCoverts = new Set();
  actionsTerrains.forEach(a => {
    if (!a.convergence) return;
    dossier.cadres.forEach(c => {
      if (a.convergence[c] && Object.keys(a.convergence[c]).length > 0) cadresCoverts.add(c);
    });
  });
  return Math.min(100, Math.round((cadresCoverts.size / dossier.cadres.length) * 60 + actionsTerrains.length * 8));
}

/* ─────────────────────────────────────────────────────────
   5. UI, Initialisation du panel Dossiers
   ───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   PONT IMPACT ← PERMA-COMPTABILITÉ
   ───────────────────────────────────────────────────────── */
function renderImpact() {
  const nb = actionsTerrains.length;

  // Bandeau source
  const srcBar = document.getElementById('impact-source-bar');
  const srcTxt = document.getElementById('impact-source-txt');
  if (srcBar) srcBar.style.display = nb > 0 ? 'flex' : 'none';
  if (srcTxt) srcTxt.textContent = `Données issues de ${nb} action${nb>1?'s':''} terrain`;

  if (nb === 0) {
    // Tout reste à "-"
    ['impact-kpi-regen','impact-kpi-co2','impact-kpi-personnes','impact-kpi-preuves'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '-';
    });
    const pl = document.getElementById('impact-proof-list');
    if (pl) pl.innerHTML = `<div style="padding:1.5rem;text-align:center;font-size:.78rem;color:var(--moss);opacity:.5">Aucune action saisie, documente via <span style="color:var(--fern);cursor:pointer;font-weight:600" onclick="piloteTab('dossiers',document.getElementById('ptab-dossiers'))">la perma-comptabilité →</span></div>`;
    return;
  }

  // ── Agrégation des données depuis actionsTerrains ──
  const covered = new Set();
  let co2Total = 0, personnesTotal = 0, alimentKg = 0, nrjKwh = 0, dechetsKg = 0;

  actionsTerrains.forEach(a => {
    const c = a.convergence;
    if (!c) return;
    if (c.ESRS) Object.keys(c.ESRS).forEach(k => covered.add(k));

    // CO₂
    if (c.ESRS?.E1?.val) co2Total += parseFloat(c.ESRS.E1.val) || 0;

    // Personnes formées (ateliers, coworking)
    if (['atelier','coworking'].includes(a.type)) personnesTotal += parseInt(a.val1) || 0;

    // Alimentation (jardin)
    if (a.type === 'jardin' && a.val2) alimentKg += parseFloat(a.val2) || 0;

    // Énergie (solaire)
    if (a.type === 'energie_solaire' && a.val1) nrjKwh += parseFloat(a.val1) || 0;

    // Déchets (repair + compostage)
    if (['repair','compostage'].includes(a.type) && a.val2) dechetsKg += parseFloat(a.val2) || 0;
  });

  // ── Vadance (0–100 basé sur couverture ESRS + nb actions) ──
  const esrsScore = Math.round((covered.size / 11) * 60);
  const actionsScore = Math.min(40, nb * 5);
  const regenScore = esrsScore + actionsScore;

  // ── KPIs ──
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('impact-kpi-regen',    regenScore + ' / 100');
  set('impact-kpi-co2',      co2Total > 0 ? (co2Total / 1000).toFixed(2) + ' t' : '-');
  set('impact-kpi-personnes', personnesTotal > 0 ? personnesTotal : '-');
  set('impact-kpi-preuves',  nb);
  set('impact-kpi-regen-trend',    regenScore >= 50 ? '✦ Éligible financement Semeur' : 'en progression');
  set('impact-kpi-co2-trend',      co2Total > 0 ? 'mesurées via perma-compta' : 'à mesurer');
  set('impact-kpi-personnes-trend', personnesTotal > 0 ? 'via ateliers & coworking' : 'à renseigner');
  set('impact-kpi-preuves-trend',  nb + ' action' + (nb>1?'s':'') + ' certifiable' + (nb>1?'s':''));

  // ── Barres impact ──
  const setBar = (fillId, valId, val, max, unit) => {
    const pct = max > 0 ? Math.min(100, Math.round(val / max * 100)) : 0;
    const f = document.getElementById(fillId); if (f) f.style.width = pct + '%';
    const v = document.getElementById(valId);
    if (v) v.textContent = val > 0 ? (val >= 1000 ? Math.round(val/1000*10)/10 + ' t' : Math.round(val) + ' ' + unit) : '-';
  };
  setBar('imp-bar-alim',  'imp-bar-val-alim',  alimentKg,    500,  'kg');
  setBar('imp-bar-pers',  'imp-bar-val-pers',  personnesTotal, 50, 'pers.');
  setBar('imp-bar-nrj',   'imp-bar-val-nrj',   nrjKwh,       2000, 'kWh');
  setBar('imp-bar-dech',  'imp-bar-val-dech',  dechetsKg,    300,  'kg');

  // ── Barres ESRS ──
  const eKeys = ['E1','E2','E3','E4','E5'], sKeys = ['S1','S2','S3','S4'], gKeys = ['G1','G2'];
  const cE = eKeys.filter(k => covered.has(k)).length;
  const cS = sKeys.filter(k => covered.has(k)).length;
  const cG = gKeys.filter(k => covered.has(k)).length;

  const setESRS = (fillId, valId, val, max) => {
    const f = document.getElementById(fillId); if (f) f.style.width = Math.round(val/max*100) + '%';
    const v = document.getElementById(valId);  if (v) v.textContent = val + ' / ' + max;
  };
  setESRS('imp-esrs-e', 'imp-esrs-e-val', cE, 5);
  setESRS('imp-esrs-s', 'imp-esrs-s-val', cS, 4);
  setESRS('imp-esrs-g', 'imp-esrs-g-val', cG, 2);
  setESRS('imp-esrs-total', 'imp-esrs-total-val', covered.size, 11);

  // ── Liste des preuves ──
  const pl = document.getElementById('impact-proof-list');
  if (pl) {
    pl.innerHTML = [...actionsTerrains].reverse().map(a => {
      const icon = PC_ICONS[a.type] || '⚡';
      const m    = CONVERGENCE_MATRIX[a.type];
      const esrsKeys = a.convergence?.ESRS ? Object.keys(a.convergence.ESRS).join(' · ') : '';
      const date = a.date ? new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) : '';
      return `
        <div style="display:flex;align-items:center;gap:.65rem;padding:.55rem .8rem;border-bottom:1px solid rgba(46,102,66,.07)">
          <span style="font-size:1rem">${icon}</span>
          <div style="flex:1">
            <div style="font-size:.75rem;font-weight:600;color:var(--ink)">${a.label}</div>
            <div style="font-size:.6rem;color:var(--moss);opacity:.55">${date}${esrsKeys ? ' · ' + esrsKeys : ''}</div>
          </div>
          <span style="font-size:.6rem;background:rgba(74,140,92,.1);color:var(--fern);padding:.15rem .5rem;border-radius:100px;font-weight:600">certifiable</span>
        </div>`;
    }).join('');
  }

  // ── Message Deva ──
  const msg = document.getElementById('deva-impact-msg');
  if (msg) {
    if (regenScore >= 60) {
      msg.textContent = `Vadance ${regenScore}/100, ton lieu est éligible aux financements Semeur. Génère le rapport pour le partager.`;
    } else {
      msg.textContent = `${nb} action${nb>1?'s':''} saisie${nb>1?'s':''} · Vadance ${regenScore}/100. Saisis ${Math.ceil((50 - regenScore) / 5)} action${Math.ceil((50-regenScore)/5)>1?'s':''} de plus pour atteindre le seuil Semeur.`;
    }
  }

  // ── Vadité (preuve) : les actions terrain certifiées alimentent l'impact prouvé ──
  if (typeof window !== 'undefined') window._evadProvenActions = nb > 0 ? regenScore : 0;
  // Reflète Vadance (promesse, figée) + Vadité (preuve) + taux dans le hero Aperçu.
  if (typeof evadReflectImpact === 'function') evadReflectImpact();

  // ── Message Deva Aperçu ──
}

/* ─── Icônes par type d'action ─── */
const PC_ICONS = {
  atelier:'🎓', coworking:'💻', energie_solaire:'☀️', isolation:'🏠',
  jardin:'🌿', compostage:'♻️', repair:'🔧', biodiversite:'🌳',
  gouvernance:'🤝', mobilite:'🚲'
};

/* ─── Rendu du journal des actions terrain ─── */
function renderJournal() {
  const list  = document.getElementById('pc-journal-list');
  const count = document.getElementById('pc-journal-count');
  if (!list) return;

  const nb = actionsTerrains.length;
  if (count) count.textContent = nb + ' entrée' + (nb > 1 ? 's' : '');

  if (nb === 0) {
    list.innerHTML = `
      <div class="pc-empty">
        <div style="font-size:1.6rem;margin-bottom:.5rem">📓</div>
        <div style="font-size:.78rem;font-weight:600;margin-bottom:.25rem">Aucune preuve pour l'instant</div>
        <div style="font-size:.67rem">Valide des quêtes pour générer tes preuves d'impact : elles apparaîtront ici et alimenteront tes rapports.</div>
      </div>`;
    return;
  }

  const BADGE_CLS = { ESRS:'esrs', ODD:'odd', PCAET:'pcaet', FSE_PLUS:'fse', ADEME:'ademe', BPI:'bpi', ESS:'bpi', NOTRe:'pcaet' };

  list.innerHTML = [...actionsTerrains].reverse().map((a, idx) => {
    const realIdx = nb - 1 - idx;
    const icon  = PC_ICONS[a.type] || '⚡';
    const date  = a.date ? new Date(a.date).toLocaleDateString('fr-FR', { day:'numeric', month:'short' }) : '-';
    const src   = a.source === 'quete' ? ' · via quête' : '';
    const m     = CONVERGENCE_MATRIX[a.type];
    const u1    = m ? m.units.u1 : '';
    const badges = a.convergence
      ? Object.keys(a.convergence).map(k =>
          `<span class="conv-badge ${BADGE_CLS[k]||'esrs'}" style="font-size:.55rem;padding:.1rem .38rem">${k==='FSE_PLUS'?'FSE+':k==='NOTRe'?'NOTRe':k}</span>`
        ).join('')
      : '';

    const pvIcon = a.preuve && a.preuve.icon ? a.preuve.icon : icon;
    const valTxt = (a.val1 !== '' && a.val1 != null) ? ' · ' + a.val1 + ' ' + u1 : '';
    const pvLine = a.preuve
      ? `<div style="font-size:.66rem;color:var(--forest);font-weight:600;margin-top:.15rem">${a.preuve.icon} ${a.preuve.label}${a.preuve.note ? ' · <span style="font-weight:400;color:var(--moss);font-style:italic">'+a.preuve.note+'</span>' : ''}</div>`
      : '';
    return `
      <div class="pc-entry">
        <div class="pc-entry-icon">${pvIcon}</div>
        <div class="pc-entry-body">
          <div class="pc-entry-label">${a.label}</div>
          <div class="pc-entry-meta">${date}${src}${valTxt}</div>
          ${pvLine}
          <div class="conv-badge-row" style="margin:0">${badges}</div>
        </div>
        <button class="pc-entry-del" onclick="supprimerAction(${realIdx})" title="Supprimer">✕</button>
      </div>`;
  }).join('');
}

/* ─── Supprimer une action du journal ─── */
function supprimerAction(idx) {
  const a = actionsTerrains[idx];
  if (!a) return;
  const nom = a.label ? ` « ${a.label} »` : '';
  if (!confirm(`Supprimer l'action${nom} du journal ?\nCette action est définitive.`)) return;
  actionsTerrains.splice(idx, 1);
  initDossiers();
  if (typeof mmBubble === 'function') mmBubble('🗑 Action supprimée du journal');
}

/* ─── Bilan ESRS agrégé ─── */
function renderBilanESRS() {
  const grid = document.getElementById('pc-bilan-grid');
  const cpt  = document.getElementById('pc-esrs-count');
  if (!grid) return;

  // Collecter tous les indicateurs ESRS couverts
  const covered = new Set();
  actionsTerrains.forEach(a => {
    if (a.convergence?.ESRS) Object.keys(a.convergence.ESRS).forEach(k => covered.add(k));
  });

  const ESRS_DEF = {
    E: [['E1','Climat'],['E2','Pollution'],['E3','Eau'],['E4','Biodiversité'],['E5','Matières']],
    S: [['S1','Salariés'],['S2','Chaîne valeur'],['S3','Communautés'],['S4','Consommateurs']],
    G: [['G1','Gouvernance'],['G2','Éthique']]
  };

  const cols = Object.entries(ESRS_DEF).map(([cat, items]) => {
    const labels = { E:'Environnement', S:'Social', G:'Gouvernance' };
    const pills  = items.map(([code, lbl]) => {
      const active = covered.has(code);
      return `<div class="pc-bilan-pill ${active ? 'active' : 'empty'}">
        <span class="pc-dot"></span>${code} · ${lbl}
      </div>`;
    }).join('');
    return `<div>
      <div class="pc-bilan-col-label ${cat.toLowerCase()}">${labels[cat]}</div>
      ${pills}
    </div>`;
  });

  // Remplace les 2 premières colonnes + garde la 3e (G + compteur)
  const gCol = `<div>
    <div class="pc-bilan-col-label g">Gouvernance</div>
    ${ESRS_DEF.G.map(([code, lbl]) => {
      const active = covered.has(code);
      return `<div class="pc-bilan-pill ${active ? 'active' : 'empty'}"><span class="pc-dot"></span>${code} · ${lbl}</div>`;
    }).join('')}
    <div style="margin-top:.6rem;padding:.55rem .7rem;background:rgba(46,102,66,.05);border-radius:var(--r);text-align:center">
      <div style="font-size:.58rem;color:var(--moss);opacity:.5;margin-bottom:.2rem">Indicateurs couverts</div>
      <div style="font-family:'Satoshi', sans-serif;font-size:1.3rem;font-weight:700;color:var(--fern)">${covered.size} / 11</div>
    </div>
  </div>`;

  grid.innerHTML = cols[0] + cols[1] + gCol;
  if (cpt) cpt.textContent = covered.size + ' / 11';
}

function initDossiers() {
  // Recharge les preuves validées depuis la base avant tout rendu : le
  // journal, l'impact et les dossiers survivent ainsi au rechargement.
  if (typeof rebuildJournalFromPreuves === 'function') rebuildJournalFromPreuves();
  renderImpact();
  renderJournal();
  renderBilanESRS();

  const grid = document.getElementById('dossier-grid');
  if (!grid) return;
  grid.innerHTML = '';
  DOSSIERS_CATALOGUE.forEach(d => {
    const pct = calculCompletude(d);
    const eco = d.valeur_economisee;
    grid.innerHTML += `
      <div class="dossier-card" onclick="ouvrirDossier('${d.id}')">
        <div class="dossier-card-icon">${d.icon}</div>
        <div class="dossier-card-name">${d.nom}</div>
        <div class="dossier-card-sub">${d.sub}</div>
        <div class="dossier-card-bar"><div class="dossier-card-fill" style="width:${pct}%"></div></div>
        <div class="dossier-card-stats">
          <span>${pct}% complété</span>
          <span style="color:var(--amber);font-weight:600">≈ ${eco.toLocaleString('fr-FR')}€ économisés</span>
        </div>
      </div>`;
  });

  // KPIs globaux
  const nbActions = actionsTerrains.length;
  const ecoTotal  = nbActions > 0 ? Math.round(nbActions * 1200) : null;
  const compMoy   = Math.round(DOSSIERS_CATALOGUE.reduce((s, d) => s + calculCompletude(d), 0) / DOSSIERS_CATALOGUE.length);

  const _set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  _set('doss-nb-actions', nbActions);
  _set('doss-economie', ecoTotal ? ecoTotal.toLocaleString('fr-FR') + '€' : '-');
  _set('doss-completude', compMoy + '%');

}

/* ─────────────────────────────────────────────────────────
   6. UI, Ouverture saisie terrain
   ───────────────────────────────────────────────────────── */
function ouvrirSaisie() {
  const block = document.getElementById('terrain-saisie-block');
  block.style.display = block.style.display === 'none' ? 'block' : 'none';
  block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* Preview live lors de la saisie */
function previewConv() {
  const type  = document.getElementById('ts-type').value;
  const val1  = document.getElementById('ts-val1').value;
  const val2  = document.getElementById('ts-val2').value;
  const prev  = document.getElementById('conv-preview');
  const cont  = document.getElementById('conv-preview-content');
  const det   = document.getElementById('conv-preview-detail');

  // Update unit labels
  const m = CONVERGENCE_MATRIX[type];
  if (m) {
    document.getElementById('ts-unit1').value = m.units.u1;
    document.getElementById('ts-unit2').value = m.units.u2;
    document.getElementById('ts-unit1-label').textContent = 'Unité 1';
    document.getElementById('ts-unit2-label').textContent = 'Unité 2';
  }

  if (!type || (!val1 && !val2)) { prev.style.display = 'none'; return; }
  const conv = convergeEntry(type, val1, val2);
  if (!conv) { prev.style.display = 'none'; return; }

  prev.style.display = 'block';

  // Badges
  const BADGE_CLASSES = { ESRS:'esrs', ODD:'odd', PCAET:'pcaet', FSE_PLUS:'fse', ADEME:'ademe', BPI:'bpi', ESS:'bpi', NOTRe:'pcaet' };
  cont.innerHTML = Object.keys(conv).map(k =>
    `<span class="conv-badge ${BADGE_CLASSES[k] || 'esrs'}">${k === 'FSE_PLUS' ? 'FSE+' : k === 'NOTRe' ? 'NOTRe' : k}</span>`
  ).join('');

  // Détails
  det.innerHTML = Object.entries(conv).map(([cadre, data]) => {
    const label = cadre === 'FSE_PLUS' ? 'FSE+' : cadre;
    const isObj = typeof data === 'object' && !Array.isArray(data);
    const val   = isObj && 'val' in data ? data.val : '';
    const unite = isObj && 'unite' in data ? data.unite : '';
    const axe   = isObj && ('axe' in data || 'critere' in data)
      ? (data.axe || data.critere || '') : '';
    return `
      <div style="padding:.38rem .55rem;background:rgba(46,102,66,.03);border:1px solid rgba(46,102,66,.07);border-radius:var(--r);font-size:.65rem">
        <div style="font-weight:700;color:var(--ink);margin-bottom:.1rem">${label}</div>
        ${axe ? `<div style="color:var(--moss);opacity:.65;margin-bottom:.1rem">${axe}</div>` : ''}
        ${val !== '' ? `<div style="color:var(--fern);font-weight:600">${typeof val === 'number' ? val.toLocaleString('fr-FR') : val} ${unite}</div>` : ''}
      </div>`;
  }).join('');
}

/* Enregistrement d'une action */
function enregistrerAction() {
  const type = document.getElementById('ts-type').value;
  const val1 = document.getElementById('ts-val1').value;
  const val2 = document.getElementById('ts-val2').value;
  const date = document.getElementById('ts-date').value;
  if (!type || !val1) { mmBubble('⚠️ Renseigne au moins le type et la quantité principale'); return; }

  const m    = CONVERGENCE_MATRIX[type];
  const conv = convergeEntry(type, val1, val2);

  actionsTerrains.push({ type, label: m ? m.label : type, val1, val2, date, convergence: conv });

  document.getElementById('terrain-saisie-block').style.display = 'none';
  document.getElementById('ts-type').value = '';
  document.getElementById('ts-val1').value = '';
  document.getElementById('ts-val2').value = '';
  document.getElementById('conv-preview').style.display = 'none';

  initDossiers();
  renderImpact();
  mmBubble(`✅ Action enregistrée → propagée dans ${Object.keys(conv).length} cadres institutionnels automatiquement`);
}

/* ─────────────────────────────────────────────────────────
   7. UI, Ouverture modale dossier détail
   ───────────────────────────────────────────────────────── */
function ouvrirDossier(id) {
  const d = DOSSIERS_CATALOGUE.find(x => x.id === id);
  if (!d) return;

  document.getElementById('doss-modal-title').textContent = d.icon + ' ' + d.nom;
  document.getElementById('doss-modal-sub').textContent   = d.sub;

  const pct = calculCompletude(d);
  const body = document.getElementById('doss-modal-body');

  // Agréger les indicateurs pour ce dossier
  let indicateursHtml = '';
  d.cadres.forEach(cadreKey => {
    const agg = agregerParCadre(cadreKey);
    const label = { ESRS:'Indicateurs ESRS', ODD:'ODD, Agenda 2030', PCAET:'PCAET / Plan Climat',
      FSE_PLUS:'FSE+, Fonds Social Européen', ADEME:'ADEME', BPI:'BPI France',
      ESS:'ESS / Utilité sociale', NOTRe:'Loi NOTRe / Compétences territoriales' }[cadreKey] || cadreKey;

    if (Object.keys(agg).length === 0 && actionsTerrains.length === 0) {
      indicateursHtml += `
        <div class="ind-section">
          <div class="ind-section-title">${label}</div>
          <div style="padding:.8rem;background:rgba(46,102,66,.03);border:1px dashed rgba(46,102,66,.2);border-radius:var(--r);font-size:.7rem;color:var(--moss);opacity:.6;text-align:center">
            Saisis tes premières actions terrain pour remplir ces indicateurs automatiquement
          </div>
        </div>`;
    } else {
      const rows = Object.keys(agg).length > 0
        ? Object.entries(agg).map(([code, data]) => `
            <div class="ind-row">
              <span class="ind-row-code conv-badge esrs">${code}</span>
              <div style="flex:1">
                <div class="ind-row-label">${data.label || data.unite || code}</div>
                ${data.sources ? `<div class="ind-row-source">Sources : ${data.sources.join(' · ')}</div>` : ''}
              </div>
              <div class="ind-row-val">${typeof data.val === 'number' ? data.val.toLocaleString('fr-FR') : '-'} <span style="font-size:.58rem;font-weight:400;color:var(--moss)">${data.unite || ''}</span></div>
            </div>`).join('')
        : d.indicateurs_cles.map(ic => `
            <div class="ind-row" style="opacity:.45">
              <span class="ind-row-code conv-badge esrs">-</span>
              <div class="ind-row-label">${ic}</div>
              <div class="ind-row-val" style="color:var(--moss)">En attente</div>
            </div>`).join('');

      indicateursHtml += `<div class="ind-section"><div class="ind-section-title">${label}</div>${rows}</div>`;
    }
  });

  body.innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(1,130,98,.06),rgba(74,171,143,.03));border:1px solid rgba(1,130,98,.12);border-radius:var(--r-lg);padding:.9rem 1.1rem;margin-bottom:1.1rem">
      <div style="font-size:.7rem;color:var(--moss);margin-bottom:.5rem">${d.description}</div>
      <div style="display:flex;align-items:center;gap:.75rem">
        <div style="flex:1;height:6px;background:rgba(46,102,66,.1);border-radius:100px">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--fern),var(--sage));border-radius:100px;transition:width .4s"></div>
        </div>
        <span style="font-size:.68rem;font-weight:700;color:var(--fern)">${pct}% complété</span>
        <span style="font-size:.62rem;color:var(--amber);font-weight:600">≈ ${d.valeur_economisee.toLocaleString('fr-FR')}€ économisés</span>
      </div>
    </div>
    ${indicateursHtml}
    `;

  document.getElementById('dossier-modal-overlay').classList.add('open');
}

function exporterDossier() {
  mmBubble('📄 Export PDF en cours de génération, données certifiées EVAD incluses ✓');
  setTimeout(() => document.getElementById('dossier-modal-overlay').classList.remove('open'), 800);
}

/* ─────────────────────────────────────────────────────────
   8. INJECTION des badges de convergence sur les quêtes
   Appelé au chargement du panel Impact
   ───────────────────────────────────────────────────────── */
function injecterBadgesConvergence() {
  // Quêtes du panel lieu (exemple avec mapping statique depuis BDD_SOLUTIONS)
  // En production : récupérer depuis actionsTerrains
  document.querySelectorAll('[data-conv-type]').forEach(el => {
    const type = el.dataset.convType;
    const m = CONVERGENCE_MATRIX[type];
    if (!m) return;
    const conv = convergeEntry(type, el.dataset.v1 || 1, el.dataset.v2 || 1);
    if (!conv) return;
    const BADGE_CLASSES = { ESRS:'esrs', ODD:'odd', PCAET:'pcaet', FSE_PLUS:'fse', ADEME:'ademe', BPI:'bpi', ESS:'bpi', NOTRe:'pcaet' };
    const badges = Object.keys(conv).map(k =>
      `<span class="conv-badge ${BADGE_CLASSES[k] || 'esrs'}">${k === 'FSE_PLUS' ? 'FSE+' : k}</span>`).join('');
    el.insertAdjacentHTML('afterend', `<div class="conv-badge-row">${badges}</div>`);
  });
}

/* Init au chargement du tab */
document.addEventListener('DOMContentLoaded', () => {
  initDossiers();
});

