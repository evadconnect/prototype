/* ─── SPIRALE VADE réutilisable (Pilote, Bâtisseur & Semeur) ───
   Valoriser → Activer → Développer → Essaimer (charte des ICI).
   Un même parcours pour les trois profils, un cran plus haut à chaque tour :
   le dessin est une spirale ouverte (et non un cercle fermé) pour montrer la
   montée. Chaque tâche est cliquable, mémorisée par compte (Supabase + cache
   local), et un bandeau « prochaine étape » pointe la première action à faire. */

/* Géométrie de la spirale : 4 nœuds posés sur une spirale d'Archimède qui
   s'écarte du centre à chaque phase, plus une amorce qui s'échappe après
   Essaimer (la signature qui distingue une spirale d'un cercle). Calculée une
   fois au chargement dans un viewBox 300×300, centre (150,150). */
const VADE_SPIRAL = (function () {
  const cx = 150, cy = 150;
  const startA = -Math.PI / 2;       // départ en haut
  const sweep = Math.PI * 2 * 1.75;  // 1,75 tour : la coil intérieure se glisse
                                     // derrière le disque et émerge vers l'extérieur
  const r0 = 18, r1 = 140;           // rayon intérieur (caché) → extérieur
  function pt(t) {
    const a = startA + t * sweep;
    const r = r0 + t * (r1 - r0);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  }
  // Les 4 nœuds occupent le tour extérieur (t 0,5 → 0,95), climbing outward.
  const nodes = [0.50, 0.65, 0.80, 0.95].map(function (t) {
    const p = pt(t);
    return { x: +p[0].toFixed(1), y: +p[1].toFixed(1) };
  });
  // Tracé de la spirale, échantillonné jusqu'à l'amorce du tour suivant (t≈1,08).
  let d = '';
  const N = 90, tEnd = 1.08;
  for (let i = 0; i <= N; i++) {
    const p = pt((i / N) * tEnd);
    d += (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' ';
  }
  // Flèche d'échappement : pointe tangente en bout de tracé.
  const pa = pt(tEnd), pb = pt(tEnd - 0.02);
  const ang = Math.atan2(pa[1] - pb[1], pa[0] - pb[0]);
  const ah = 7;
  function arrowPt(off) {
    return (pa[0] + ah * Math.cos(ang + off)).toFixed(1) + ' ' + (pa[1] + ah * Math.sin(ang + off)).toFixed(1);
  }
  const arrow = 'M ' + arrowPt(Math.PI - 0.5) + ' L ' + pa[0].toFixed(1) + ' ' + pa[1].toFixed(1) + ' L ' + arrowPt(Math.PI + 0.5);
  return { nodes: nodes, path: d.trim(), arrow: arrow };
})();

const REGEN_LOOP_NODES = [
  { letter: 'V', name: 'Valoriser',  color: '#018262' },
  { letter: 'A', name: 'Activer',    color: '#2d6a9f' },
  { letter: 'D', name: 'Développer', color: '#c8732a' },
  { letter: 'E', name: 'Essaimer',   color: '#6b5b95' },
].map(function (n, k) { return Object.assign({}, n, VADE_SPIRAL.nodes[k]); });

/* Chaque tâche / outil : { t: libellé, go: destination } où `go` est optionnel.
   go = 'carte' | 'reseau' | 'bdd' | 'marketplace' | 'modelisation' (écran), ou
   '@tab' pour un onglet du dashboard du profil courant (ex. '@quetes'). */
const REGEN_PROFILE_CONTENT = {
  pilote: {
    label: 'Pilote',
    intro: 'Valoriser → Activer → Développer → Essaimer. Tu as déjà franchi les premières étapes en créant ton lieu ✅, clique une phase pour voir ce qu\'il reste.',
    steps: [
      { title: 'Valoriser l\'existant', desc: 'Établir la base de référence T0 et repérer l\'impact déjà présent sur le lieu.', tags: ['📍 Diagnostic T0', '📚 Bibliothèque d\'ICI'],
        outils: [{ t: 'Diagnostic T0', go: '@fiche' }, { t: 'Bibliothèque d\'ICI', go: 'bdd' }, { t: 'Deva' }],
        taches: [{ t: 'Établir la base de référence T0 de ton lieu', go: '@fiche' }, { t: 'Repérer l\'impact déjà présent (écologie, social, économie locale)', go: '@fiche' }, { t: 'Identifier les ICI pertinents avec l\'aide de Deva', go: 'bdd' }],
        preDone: [true, true, true] },
      { title: 'Activer les solutions', desc: 'Déclarer les solutions mises en œuvre et mobiliser la communauté.', tags: ['🌱 Solutions', '🤝 Communauté'],
        outils: [{ t: 'Bibliothèque de solutions', go: 'bdd' }, { t: 'Déclaration des ICI', go: '@fiche' }, { t: 'Quêtes', go: '@quetes' }],
        taches: [{ t: 'Déclarer les solutions que tu mets en œuvre', go: '@fiche' }, { t: 'Chaque solution embarque ses ICI à suivre', go: '@fiche' }, { t: 'Ouvrir des quêtes et mobiliser les Bâtisseurs', go: '@quetes' }],
        preDone: [true, true, false] },
      { title: 'Développer la preuve', desc: 'Mesurer et prouver l\'impact, puis sécuriser le financement.', tags: ['📊 Vadité', '💶 Financement'],
        outils: [{ t: 'Mesure d\'impact', go: '@dossiers' }, { t: 'Attestation Vadité', go: '@dossiers' }, { t: 'Monnaie Vade', go: '@dossiers' }],
        taches: [{ t: 'Saisir les valeurs observées et leur niveau de preuve', go: '@dossiers' }, { t: 'Produire l\'attestation Vadité (impact réellement prouvé)', go: '@dossiers' }, { t: 'Sécuriser le financement des Semeurs en euros', go: '@dossiers' }] },
      { title: 'Essaimer le commun', desc: 'Faire vérifier par les pairs et l\'audit, puis faire remonter les retours dans le référentiel.', tags: ['🔍 Audit tiers', '🌍 Commun ouvert'],
        outils: [{ t: 'Audit tiers', go: 'reseau' }, { t: 'Passeport du lieu', go: 'reseau' }, { t: 'Amendement du commun', go: 'bdd' }],
        taches: [{ t: 'Faire vérifier tes preuves par les pairs puis l\'audit tiers', go: 'reseau' }, { t: 'Publier le passeport du lieu', go: 'reseau' }, { t: 'Remonter tes retours pour amender le référentiel commun', go: 'bdd' }] },
    ],
  },
  batisseur: {
    label: 'Bâtisseur',
    intro: 'Valoriser → Activer → Développer → Essaimer : le même parcours que les autres profils. Clique une phase, puis coche les tâches faites.',
    steps: [
      { title: 'Valoriser : repérer où ton impact compte', desc: 'Découvrir les lieux et leur base T0, repérer les boucles où tes compétences font la différence.', tags: ['📍 Diagnostic T0', '🔍 Découverte'],
        outils: [{ t: 'Carte', go: 'carte' }, { t: 'Modélisation 3D', go: 'modelisation' }, { t: 'Deva' }],
        taches: [{ t: 'Explorer les lieux et leur diagnostic T0', go: 'carte' }, { t: 'Repérer les boucles où tes compétences comptent', go: 'carte' }, { t: 'Te projeter dans une contribution idéale', go: 'carte' }] },
      { title: 'Activer : rejoindre les quêtes', desc: 'Répondre aux quêtes ouvertes et passer à l\'action sur le terrain.', tags: ['⚡ Action', '🤝 Communauté'],
        outils: [{ t: 'Quêtes', go: '@quetes' }, { t: 'Réseau', go: 'reseau' }, { t: 'la Récolte', go: '@graines' }],
        taches: [{ t: 'Parcourir les quêtes ouvertes sur la carte', go: 'carte' }, { t: 'Rejoindre une quête alignée avec tes valeurs', go: '@quetes' }, { t: 'Mobiliser ta communauté autour de l\'action', go: 'reseau' }] },
      { title: 'Développer : prouver l\'impact', desc: 'Réaliser les quêtes-preuve, documenter les preuves, gagner du Vade.', tags: ['📊 Preuve', '🪙 Vade'],
        outils: [{ t: 'Quêtes-preuve', go: '@quetes' }, { t: 'Preuves', go: '@quetes' }, { t: 'Monnaie Vade', go: '@graines' }],
        taches: [{ t: 'Contribuer sur le terrain', go: '@quetes' }, { t: 'Documenter les preuves (photos, registres)', go: '@quetes' }, { t: 'Recevoir ton Vade en contrepartie', go: '@graines' }] },
      { title: 'Essaimer : nourrir le commun', desc: 'Faire vérifier, partager tes retours, enrichir le référentiel commun.', tags: ['🔍 Pairs', '🌍 Commun'],
        outils: [{ t: 'Vérification pairs', go: 'reseau' }, { t: 'Bibliothèque', go: 'bdd' }, { t: 'Amendement du commun', go: 'bdd' }],
        taches: [{ t: 'Faire vérifier tes preuves par les pairs', go: 'reseau' }, { t: 'Partager ton retour d\'expérience', go: 'reseau' }, { t: 'Enrichir les fiches des communs', go: 'bdd' }] },
    ],
  },
  semeur: {
    label: 'Semeur',
    intro: 'Valoriser → Activer → Développer → Essaimer : le même parcours que les autres profils. Clique une phase, puis coche les tâches faites.',
    steps: [
      { title: 'Valoriser : découvrir les lieux à fort impact', desc: 'Explorer les passeports de lieux et leur base T0, repérer l\'impact déjà présent.', tags: ['📍 Diagnostic T0', '🔍 Sourcing'],
        outils: [{ t: 'Carte', go: 'carte' }, { t: 'Passeport du lieu', go: 'carte' }, { t: 'Réseau', go: 'reseau' }],
        taches: [{ t: 'Parcourir les lieux et leur diagnostic T0', go: 'carte' }, { t: 'Filtrer selon tes critères ESRS / ODD', go: 'carte' }, { t: 'Présélectionner des lieux à financer', go: '@portefeuille' }] },
      { title: 'Activer : engager le capital', desc: 'Financer en euros contre des paliers signés, ouvrir le projet.', tags: ['💶 Financement', '🤝 Engagement'],
        outils: [{ t: 'Contrats à impact', go: '@portefeuille' }, { t: 'Paliers signés', go: '@portefeuille' }, { t: 'Portefeuille', go: '@portefeuille' }],
        taches: [{ t: 'Engager des euros sur un ou plusieurs projets', go: '@portefeuille' }, { t: 'Définir les paliers et jalons signés', go: '@portefeuille' }, { t: 'Préciser ta thèse d\'investissement', go: '@rse' }] },
      { title: 'Développer : suivre la preuve', desc: 'Suivre le fil en direct, vérifier la Vadité (impact réellement prouvé).', tags: ['📊 Vadité', '📈 Indice de confiance'],
        outils: [{ t: 'Mesure d\'impact', go: '@rse' }, { t: 'Attestation Vadité', go: '@rse' }, { t: 'Suivi en direct', go: '@portefeuille' }],
        taches: [{ t: 'Suivre l\'avancée des quêtes en direct', go: '@portefeuille' }, { t: 'Vérifier les preuves et l\'indice de confiance', go: '@rse' }, { t: 'Sécuriser la Vadité de ton financement', go: '@rse' }] },
      { title: 'Essaimer : recevoir la Vadité', desc: 'Recevoir l\'attestation Vadité et le dividende d\'impact, capitaliser.', tags: ['📑 Attestation', '📄 CSRD'],
        outils: [{ t: 'Attestation Vadité', go: '@rse' }, { t: 'Export CSRD', go: '@rse' }, { t: 'Dividende d\'impact', go: '@graines' }],
        taches: [{ t: 'Recevoir la Vadité (ΔVadance / CSRD)', go: '@rse' }, { t: 'Produire ton reporting CSRD', go: '@rse' }, { t: 'Toucher ton dividende d\'impact', go: '@graines' }] },
    ],
  },
};

const regenLoopState = {};

/* Navigation depuis une tâche/un outil vers l'écran concerné. `profileKey`
   sert à résoudre les onglets '@tab' du bon dashboard. */
function vadeGo(profileKey, go) {
  if (!go || typeof showScreen !== 'function') return;
  const dash = { pilote: ['pilote', 'piloteTab', 'ptab-'], batisseur: ['quete', 'batTab', 'btab-'], semeur: ['semeur', 'semeurTab', 'stab-'] }[profileKey];
  if (go.charAt(0) === '@' && dash) {
    const tab = go.slice(1);
    showScreen(dash[0]);
    setTimeout(function () {
      const fn = window[dash[1]];
      if (typeof fn === 'function') fn(tab, document.getElementById(dash[2] + tab));
    }, 150);
  } else {
    showScreen(go);
  }
}

function regenLoopBuild(prefix, profileKey) {
  const cont = document.getElementById(prefix);
  if (!cont) return;
  const prof = REGEN_PROFILE_CONTENT[profileKey];
  if (!prof) return;
  if (!regenLoopState[prefix]) {
    regenLoopState[prefix] = {
      selected: 0, profile: profileKey,
      done: prof.steps.map(function (s) { return s.taches.map(function (_, i) { return !!(s.preDone && s.preDone[i]); }); }),
    };
  }
  const st = regenLoopState[prefix];
  const nodes = REGEN_LOOP_NODES.map(function (n, k) {
    return '<div onclick="regenLoopSelect(\'' + prefix + '\',' + k + ')" style="position:absolute;left:' + n.x + 'px;top:' + n.y + 'px;transform:translate(-50%,-20px);text-align:center;cursor:pointer;z-index:2">'
      + '<div id="' + prefix + '-circ-' + k + '" style="width:40px;height:40px;border-radius:50%;background:white;border:2.5px solid ' + n.color + ';color:' + n.color + ';display:flex;align-items:center;justify-content:center;font-family:\'Satoshi\', sans-serif;font-weight:900;font-size:1rem;margin:0 auto;transition:transform .25s,box-shadow .25s,background .2s">' + n.letter + '</div>'
      + '<div id="' + prefix + '-lbl-' + k + '" style="font-size:.6rem;color:var(--moss);font-weight:600;margin-top:.28rem;white-space:nowrap">' + n.name + '</div>'
      + '</div>';
  }).join('');
  cont.innerHTML =
    '<div style="background:white;border:1px solid rgba(46,102,66,.12);border-radius:var(--r-lg);padding:1.3rem 1.4rem 1.5rem">'
    + '<div style="margin-bottom:.5rem">'
    + '<div style="font-family:\'Satoshi\', sans-serif;font-size:.95rem;font-weight:800;color:var(--ink)">🌀 Spirale VADE · ton parcours</div>'
    + '<div style="font-size:.63rem;color:var(--moss);opacity:.65;margin-top:.15rem;line-height:1.4">' + prof.intro + '</div>'
    + '</div>'
    + '<div id="' + prefix + '-banner"></div>'
    + '<div style="display:flex;justify-content:center">'
    + '<div style="position:relative;width:300px;height:300px;margin:.4rem 0 .2rem">'
    + '<svg width="300" height="300" viewBox="0 0 300 300" style="position:absolute;inset:0;pointer-events:none">'
    + '<path d="' + VADE_SPIRAL.path + '" fill="none" stroke="rgba(46,102,66,.2)" stroke-width="2" stroke-linecap="round"/>'
    + '<path d="' + VADE_SPIRAL.arrow + '" fill="none" stroke="var(--sage)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    + '</svg>'
    + '<div style="position:absolute;left:150px;top:150px;transform:translate(-50%,-50%);width:100px;height:100px;border-radius:50%;background:white;border:1px solid rgba(46,102,66,.1);box-shadow:0 2px 14px rgba(46,102,66,.07);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:1">'
    + '<div style="font-size:.46rem;color:var(--sage);text-transform:uppercase;letter-spacing:.14em;font-weight:700">Progression</div>'
    + '<div id="' + prefix + '-center-score" style="font-family:\'Satoshi\', sans-serif;font-size:1.35rem;font-weight:900;color:#018262;line-height:1;margin:.15rem 0 .05rem">0</div>'
    + '<div id="' + prefix + '-center-sub" style="font-size:.55rem;color:var(--moss);opacity:.7">🌱 à démarrer</div>'
    + '</div>'
    + nodes
    + '</div>'
    + '</div>'
    + '<div id="' + prefix + '-detail" style="border-top:1px solid rgba(46,102,66,.1);margin-top:.4rem;padding-top:1.2rem"></div>'
    + '</div>';
  regenLoopSelect(prefix, st.selected);
  regenLoopUpdateCenter(prefix);
  regenLoopRenderBanner(prefix);
  vadeParcoursLoad(prefix, profileKey);
}

function regenLoopSelect(prefix, i) {
  const st = regenLoopState[prefix]; if (!st) return; st.selected = i;
  REGEN_LOOP_NODES.forEach(function (n, k) {
    const circ = document.getElementById(prefix + '-circ-' + k), lbl = document.getElementById(prefix + '-lbl-' + k);
    if (!circ) return;
    if (k === i) { circ.style.background = n.color; circ.style.color = 'white'; circ.style.transform = 'scale(1.18)'; circ.style.boxShadow = '0 4px 14px ' + n.color + '55'; if (lbl) { lbl.style.color = n.color; lbl.style.fontWeight = '800'; } }
    else { circ.style.background = 'white'; circ.style.color = n.color; circ.style.transform = ''; circ.style.boxShadow = ''; if (lbl) { lbl.style.color = 'var(--moss)'; lbl.style.fontWeight = '600'; } }
  });
  regenLoopRenderDetail(prefix);
}

function regenLoopToggleTask(prefix, s, t) {
  const st = regenLoopState[prefix]; if (!st) return;
  const prof = REGEN_PROFILE_CONTENT[st.profile];
  const wasComplete = st.done[s].every(Boolean);
  st.done[s][t] = !st.done[s][t];
  const nowComplete = st.done[s].every(Boolean);
  regenLoopRenderDetail(prefix); regenLoopUpdateCenter(prefix); regenLoopRenderBanner(prefix);
  vadeParcoursSave(prefix, st.profile);
  // Micro-récompense : la phase vient d'être bouclée → le nœud pulse.
  if (!wasComplete && nowComplete) regenLoopPulse(prefix, s);
}

function regenLoopPulse(prefix, k) {
  const circ = document.getElementById(prefix + '-circ-' + k);
  if (!circ) return;
  const base = (regenLoopState[prefix] && regenLoopState[prefix].selected === k) ? 1.18 : 1;
  circ.style.transform = 'scale(' + (base + 0.35) + ')';
  setTimeout(function () { circ.style.transform = base > 1 ? 'scale(' + base + ')' : ''; }, 260);
}

function regenLoopGoNext(prefix) {
  const st = regenLoopState[prefix]; if (!st) return;
  const prof = REGEN_PROFILE_CONTENT[st.profile];
  const nx = vadeParcoursNext(st, prof);
  if (!nx) return;
  regenLoopSelect(prefix, nx.i);
  const box = document.getElementById(prefix + '-detail');
  if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (nx.task && nx.task.go) vadeGo(st.profile, nx.task.go);
}

function vadeParcoursNext(st, prof) {
  for (let i = 0; i < prof.steps.length; i++) {
    const d = st.done[i];
    for (let j = 0; j < d.length; j++) {
      if (!d[j]) return { i: i, j: j, step: prof.steps[i], task: prof.steps[i].taches[j] };
    }
  }
  return null;
}

function regenLoopRenderBanner(prefix) {
  const box = document.getElementById(prefix + '-banner'); if (!box) return;
  const st = regenLoopState[prefix]; const prof = REGEN_PROFILE_CONTENT[st.profile];
  const nx = vadeParcoursNext(st, prof);
  if (!nx) {
    box.innerHTML = '<div style="display:flex;align-items:center;gap:.6rem;background:rgba(1,130,98,.08);border:1px solid rgba(1,130,98,.25);border-radius:var(--r);padding:.7rem .85rem;margin-bottom:.7rem">'
      + '<div style="font-size:1.2rem">🌳</div>'
      + '<div style="font-size:.72rem;color:var(--ink);line-height:1.4"><b>Boucle complète.</b> Ton lieu redémarre un cran plus haut : propose des quêtes plus ambitieuses au prochain tour.</div>'
      + '</div>';
    return;
  }
  const node = REGEN_LOOP_NODES[nx.i];
  const label = (nx.task && nx.task.t) ? nx.task.t : '';
  box.innerHTML = '<div style="display:flex;align-items:center;gap:.7rem;background:' + node.color + '12;border:1px solid ' + node.color + '40;border-radius:var(--r);padding:.65rem .8rem;margin-bottom:.7rem">'
    + '<div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:' + node.color + ';color:white;display:flex;align-items:center;justify-content:center;font-family:\'Satoshi\', sans-serif;font-weight:900;font-size:.85rem">' + node.letter + '</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:.52rem;font-weight:700;color:' + node.color + ';text-transform:uppercase;letter-spacing:.1em">Ta prochaine étape · ' + node.name + '</div>'
    + '<div style="font-size:.75rem;color:var(--ink);font-weight:600;line-height:1.3;margin-top:.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + label + '</div>'
    + '</div>'
    + '<button onclick="regenLoopGoNext(\'' + prefix + '\')" style="flex-shrink:0;background:' + node.color + ';color:white;border:none;border-radius:100px;padding:.4rem .8rem;font-size:.68rem;font-weight:700;cursor:pointer;font-family:inherit">Y aller →</button>'
    + '</div>';
}

function regenLoopRenderDetail(prefix) {
  const box = document.getElementById(prefix + '-detail'); if (!box) return;
  const st = regenLoopState[prefix]; const prof = REGEN_PROFILE_CONTENT[st.profile];
  const i = st.selected, node = REGEN_LOOP_NODES[i], s = prof.steps[i], done = st.done[i];
  const nDone = done.filter(Boolean).length;
  const tags = s.tags.map(function (t) { return '<span style="font-size:.6rem;font-weight:600;color:var(--moss);background:rgba(46,102,66,.08);border-radius:100px;padding:.25rem .6rem">' + t + '</span>'; }).join('');
  const outils = s.outils.map(function (o) {
    const clickable = !!o.go;
    const attrs = clickable ? ' onclick="vadeGo(\'' + st.profile + '\',\'' + o.go + '\')" style="cursor:pointer;font-size:.62rem;font-weight:600;color:' + node.color + ';border:1px solid ' + node.color + '40;border-radius:100px;padding:.28rem .7rem;background:none;font-family:inherit"'
      : ' style="font-size:.62rem;font-weight:600;color:var(--moss);opacity:.75;border:1px solid rgba(46,102,66,.2);border-radius:100px;padding:.28rem .7rem;background:none;font-family:inherit"';
    return '<button' + attrs + '>' + o.t + (clickable ? ' ↗' : '') + '</button>';
  }).join('');
  const taches = s.taches.map(function (t, k) {
    const on = done[k];
    const arrow = t.go ? '<button onclick="event.stopPropagation();vadeGo(\'' + st.profile + '\',\'' + t.go + '\')" title="Aller à l\'écran" style="flex-shrink:0;background:none;border:none;color:' + node.color + ';font-size:.9rem;cursor:pointer;padding:.1rem .3rem;border-radius:6px">↗</button>' : '';
    return '<div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .2rem;border-bottom:1px solid rgba(46,102,66,.08)">'
      + '<div onclick="regenLoopToggleTask(\'' + prefix + '\',' + i + ',' + k + ')" style="flex:1;display:flex;align-items:center;gap:.7rem;cursor:pointer;min-width:0">'
      + '<div style="width:24px;height:24px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:800;color:white;background:' + (on ? node.color : 'rgba(46,102,66,.18)') + ';transition:background .15s">' + (on ? '✓' : (k + 1)) + '</div>'
      + '<div style="font-size:.76rem;color:var(--ink);line-height:1.35;' + (on ? 'text-decoration:line-through;opacity:.5' : '') + '">' + t.t + '</div>'
      + '</div>' + arrow
      + '</div>';
  }).join('');
  box.innerHTML =
    '<div style="display:flex;align-items:flex-start;gap:.85rem;margin-bottom:.7rem">'
    + '<div style="width:46px;height:46px;border-radius:12px;background:' + node.color + ';color:white;display:flex;align-items:center;justify-content:center;font-family:\'Satoshi\', sans-serif;font-weight:900;font-size:1.3rem;flex-shrink:0">' + node.letter + '</div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:.58rem;font-weight:700;color:' + node.color + ';text-transform:uppercase;letter-spacing:.1em">Phase ' + (i + 1) + ' / ' + prof.steps.length + ' · ' + node.name + ' · ' + prof.label + '</div>'
    + '<div style="font-family:\'Satoshi\', sans-serif;font-size:1.2rem;font-weight:900;color:var(--ink);line-height:1.15;margin-top:.15rem">' + s.title + '</div>'
    + '</div>'
    + '</div>'
    + '<div style="font-size:.78rem;color:var(--moss);line-height:1.5;margin-bottom:.8rem">' + s.desc + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1rem">' + tags + '</div>'
    + '<div style="font-size:.58rem;font-weight:700;color:var(--moss);opacity:.6;text-transform:uppercase;letter-spacing:.12em;margin-bottom:.45rem">Outils mobilisés</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:1.1rem">' + outils + '</div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">'
    + '<span style="font-size:.58rem;font-weight:700;color:var(--moss);opacity:.6;text-transform:uppercase;letter-spacing:.12em">À faire</span>'
    + '<span style="font-size:.62rem;font-weight:700;color:' + node.color + '">' + nDone + '/' + s.taches.length + ' fait' + (nDone > 1 ? 's' : '') + '</span>'
    + '</div>'
    + '<div>' + taches + '</div>';
}

function regenLoopUpdateCenter(prefix) {
  const st = regenLoopState[prefix]; if (!st) return;
  const total = st.done.reduce(function (a, arr) { return a + arr.length; }, 0);
  const done = st.done.reduce(function (a, arr) { return a + arr.filter(Boolean).length; }, 0);
  const scoreEl = document.getElementById(prefix + '-center-score');
  const sub = document.getElementById(prefix + '-center-sub');
  if (scoreEl) scoreEl.innerHTML = done + '<span style="font-size:.6rem;font-weight:700;opacity:.45">/' + total + '</span>';
  if (!sub) return;
  if (done === 0) sub.textContent = '🌱 à démarrer';
  else if (done >= total) sub.textContent = '🌳 boucle complète';
  else sub.textContent = '🌿 en cours';
}

/* ─── Persistance : cache localStorage (instantané) + Supabase (par compte) ─── */
function vadeParcoursApply(st, arr) {
  if (!Array.isArray(arr)) return;
  for (let i = 0; i < st.done.length; i++) {
    if (!Array.isArray(arr[i])) continue;
    for (let j = 0; j < st.done[i].length; j++) {
      if (typeof arr[i][j] === 'boolean') st.done[i][j] = arr[i][j];
    }
  }
}

function vadeParcoursRefresh(prefix) {
  regenLoopSelect(prefix, regenLoopState[prefix].selected);
  regenLoopUpdateCenter(prefix);
  regenLoopRenderBanner(prefix);
}

async function vadeParcoursLoad(prefix, profileKey) {
  const st = regenLoopState[prefix]; if (!st) return;
  const key = 'evad:vade:' + profileKey;
  let hadCache = false;
  try {
    const raw = localStorage.getItem(key);
    if (raw) { vadeParcoursApply(st, JSON.parse(raw)); hadCache = true; }
  } catch (e) {}
  if (hadCache) vadeParcoursRefresh(prefix);
  try {
    if (!window.evadSupabase) return;
    const s = await window.evadSupabase.auth.getSession();
    const uid = s && s.data && s.data.session && s.data.session.user && s.data.session.user.id;
    if (!uid) return;
    st._uid = uid;
    const r = await window.evadSupabase.from('vade_parcours').select('done').eq('user_id', uid).eq('role', profileKey).maybeSingle();
    if (r && r.data && Array.isArray(r.data.done)) {
      vadeParcoursApply(st, r.data.done);
      try { localStorage.setItem(key, JSON.stringify(st.done)); } catch (e) {}
      vadeParcoursRefresh(prefix);
    }
  } catch (e) { /* hors-ligne ou table absente : le cache local suffit */ }
}

function vadeParcoursSave(prefix, profileKey) {
  const st = regenLoopState[prefix]; if (!st) return;
  try { localStorage.setItem('evad:vade:' + profileKey, JSON.stringify(st.done)); } catch (e) {}
  if (!window.evadSupabase || !st._uid) return;
  clearTimeout(st._saveT);
  st._saveT = setTimeout(function () {
    window.evadSupabase.from('vade_parcours')
      .upsert({ user_id: st._uid, role: profileKey, done: st.done, updated_at: new Date().toISOString() }, { onConflict: 'user_id,role' })
      .then(function () {}, function () {});
  }, 600);
}
