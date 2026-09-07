/* EVAD · passeport.js — Passeport d'Impact des Bâtisseurs et des lieux.
   ------------------------------------------------------------------
   Un CV d'impact : ce qu'une personne ou un lieu a réellement fait, prouvé,
   et ce que ça lui ouvre. Il ne raconte rien qui ne soit adossé à une donnée
   du store (quêtes, inscriptions, preuves validées) : un passeport qui se
   contenterait d'afficher un beau chiffre serait exactement le greenwashing
   qu'EVAD combat.

   Le score porte le nom de Vadité : la part des engagements réellement
   prouvée. Sa décomposition est affichée à côté, comme pour les indicateurs
   de changement d'impact, pour que personne n'ait à croire le chiffre sur
   parole.

   Vocabulaire : on écrit « graines » et « la Récolte », le lexique d'essai
   (lexique-dev.js) les affiche en « Vadins » et « Vaderie » hors production. */
(function (global) {
  'use strict';

  /* ── Niveaux ───────────────────────────────────────────────────────── */
  var NIVEAUX = [
    { id: 'or',      min: 90, label: 'Or',     ic: '🥇', col: '#b8860b', bg: 'rgba(200,160,42,.14)', bord: 'rgba(200,160,42,.45)' },
    { id: 'argent',  min: 70, label: 'Argent', ic: '🥈', col: '#6b7785', bg: 'rgba(120,133,148,.14)', bord: 'rgba(120,133,148,.45)' },
    { id: 'bronze',  min: 50, label: 'Bronze', ic: '🥉', col: '#a2622f', bg: 'rgba(176,112,58,.14)', bord: 'rgba(176,112,58,.45)' },
    { id: 'jeune',   min: 0,  label: 'En construction', ic: '🌱', col: '#4a8c5c', bg: 'rgba(74,140,92,.1)', bord: 'rgba(74,140,92,.3)' }
  ];
  function niveauPour(score) {
    for (var i = 0; i < NIVEAUX.length; i++) if (score >= NIVEAUX[i].min) return NIVEAUX[i];
    return NIVEAUX[NIVEAUX.length - 1];
  }
  // Ce qu'il reste à parcourir avant le palier suivant : un passeport doit
  // dire quoi faire ensuite, pas seulement où l'on en est.
  function prochainNiveau(score) {
    for (var i = NIVEAUX.length - 1; i >= 0; i--) if (NIVEAUX[i].min > score) return NIVEAUX[i];
    return null;
  }

  function st() { return global.store || null; }
  function ou(v, d) { return (v == null || v === '') ? d : v; }
  function pct(n, d) { return d > 0 ? Math.min(1, n / d) : 0; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Compétences : un domaine se gagne en le pratiquant ────────────── */
  function paliersCompetence(n) {
    if (n >= 4) return 'Expert';
    if (n >= 2) return 'Confirmé';
    return 'Découverte';
  }
  function domaineDeQuete(q) {
    return (q && (q.competence || q.source)) || 'Action de terrain';
  }

  /* ── Passeport d'un Bâtisseur ──────────────────────────────────────── */
  function passeportBatisseur(batId) {
    var s = st();
    var p = {
      kind: 'batisseur', id: batId, nom: 'Bâtisseur', ic: '🌿', accent: '#c8732a',
      score: 0, niveau: niveauPour(0), suivant: prochainNiveau(0),
      composantes: [], quetes: [], competences: [], recommandations: [],
      nbTerminees: 0, nbEnCours: 0, nbPreuves: 0, graines: 0, vide: true
    };
    if (!s || !batId) return p;

    var fiche = null;
    try { fiche = s.get('batisseurs', batId); } catch (e) {}
    if (fiche) p.nom = ((ou(fiche.prenom, '') + ' ' + ou(fiche.nom, '')).trim()) || 'Bâtisseur';

    // Inscriptions validées uniquement : une candidature en attente n'est pas
    // un engagement tenu, elle n'a rien à faire dans un passeport.
    var cands = s.where('quete_candidatures', function (c) {
      return c && c.batisseur_id === batId && c.statut === 'inscrit';
    });

    var domaines = {};
    var terminees = 0, enCours = 0, prouvees = 0, preuvesValidees = 0, graines = 0;

    cands.forEach(function (c) {
      var q = c.quete_id ? s.get('quetes', c.quete_id) : null;
      if (!q) return;
      var preuves = s.where('quete_preuves', function (x) {
        return x && x.quete_id === q.id && x.batisseur_id === batId;
      });
      var val = preuves.filter(function (x) { return x.validee === true; });
      var lieu = q.lieu_id ? s.get('lieux', q.lieu_id) : null;

      if (q.statut === 'terminee') {
        terminees++;
        graines += (parseInt(q.graines, 10) || 0);
        preuvesValidees += val.length;
        if (val.length) prouvees++;
        var d = domaineDeQuete(q);
        domaines[d] = (domaines[d] || 0) + 1;
        p.quetes.push({
          srcId: q.id, titre: ou(q.titre, 'Quête'), ic: ou(q.sourceIc, '⚡'),
          lieu: (lieu && lieu.nom) || ou(q.lieu_nom, 'Lieu EVAD'),
          graines: parseInt(q.graines, 10) || 0,
          preuves: preuves.length, validees: val.length,
          domaine: d, dateISO: q.dateISO || null
        });
      } else if (q.statut === 'ouverte') {
        enCours++;
      }
    });

    p.nbTerminees = terminees; p.nbEnCours = enCours;
    p.nbPreuves = preuvesValidees; p.graines = graines;
    p.vide = (terminees === 0 && enCours === 0);

    // Compétences : les domaines pratiqués, du plus au moins fréquent.
    p.competences = Object.keys(domaines).map(function (d) {
      return { nom: d, n: domaines[d], palier: paliersCompetence(domaines[d]) };
    }).sort(function (a, b) { return b.n - a.n; });

    /* Score. Quatre composantes, toutes issues de données réelles. La preuve
       pèse le plus lourd : c'est elle qui distingue une promesse d'un fait. */
    var c1 = Math.round(pct(prouvees, terminees) * 40);
    var c2 = Math.round(pct(terminees, 6) * 25);
    var c3 = Math.round(pct(preuvesValidees, 8) * 20);
    var c4 = Math.round(pct(p.competences.length, 4) * 15);
    p.score = Math.max(0, Math.min(100, c1 + c2 + c3 + c4));
    p.niveau = niveauPour(p.score);
    p.suivant = prochainNiveau(p.score);
    p.composantes = [
      { label: 'Quêtes prouvées', val: c1, max: 40, detail: prouvees + ' quête' + (prouvees > 1 ? 's' : '') + ' terminée' + (prouvees > 1 ? 's' : '') + ' avec une preuve validée sur ' + terminees + ' terminée' + (terminees > 1 ? 's' : '') },
      { label: 'Expérience',      val: c2, max: 25, detail: terminees + ' quête' + (terminees > 1 ? 's' : '') + ' menée' + (terminees > 1 ? 's' : '') + ' au bout (plafond à 6)' },
      { label: 'Preuves validées', val: c3, max: 20, detail: preuvesValidees + ' preuve' + (preuvesValidees > 1 ? 's' : '') + ' validée' + (preuvesValidees > 1 ? 's' : '') + ' par un Pilote (plafond à 8)' },
      { label: 'Domaines',        val: c4, max: 15, detail: p.competences.length + ' domaine' + (p.competences.length > 1 ? 's' : '') + ' de compétence pratiqué' + (p.competences.length > 1 ? 's' : '') + ' (plafond à 4)' }
    ];

    p.recommandations = recommanderPourBatisseur(batId, p);
    return p;
  }

  /* ── Passeport d'un lieu ───────────────────────────────────────────── */
  function passeportLieu(lieuId) {
    var s = st();
    var p = {
      kind: 'lieu', id: lieuId, nom: 'Lieu', ic: '🏡', accent: '#2e6642',
      score: 0, niveau: niveauPour(0), suivant: prochainNiveau(0),
      composantes: [], quetes: [], competences: [], recommandations: [],
      nbTerminees: 0, nbEnCours: 0, nbPreuves: 0, graines: 0,
      batisseurs: 0, sansPreuve: 0, vide: true
    };
    if (!s || !lieuId) return p;

    var fiche = null;
    try { fiche = s.get('lieux', lieuId); } catch (e) {}
    if (fiche) { p.nom = ou(fiche.nom, 'Lieu'); p.ic = ou(fiche.icon, '🏡'); }

    var qs = s.where('quetes', function (q) {
      return q && q.lieu_id === lieuId && (q.statut === 'ouverte' || q.statut === 'terminee');
    });

    var domaines = {}, batset = {};
    var terminees = 0, enCours = 0, prouvees = 0, preuvesValidees = 0, graines = 0;

    qs.forEach(function (q) {
      var preuves = s.where('quete_preuves', function (x) { return x && x.quete_id === q.id; });
      var val = preuves.filter(function (x) { return x.validee === true; });
      s.where('quete_candidatures', function (c) {
        return c && c.quete_id === q.id && c.statut === 'inscrit';
      }).forEach(function (c) { if (c.batisseur_id) batset[c.batisseur_id] = 1; });

      if (q.statut === 'terminee') {
        terminees++;
        graines += (parseInt(q.graines, 10) || 0);
        preuvesValidees += val.length;
        if (val.length) prouvees++;
        var d = domaineDeQuete(q);
        domaines[d] = (domaines[d] || 0) + 1;
        p.quetes.push({
          srcId: q.id, titre: ou(q.titre, 'Quête'), ic: ou(q.sourceIc, '⚡'),
          lieu: p.nom, graines: parseInt(q.graines, 10) || 0,
          preuves: preuves.length, validees: val.length,
          domaine: d, dateISO: q.dateISO || null
        });
      } else {
        enCours++;
      }
    });

    p.nbTerminees = terminees; p.nbEnCours = enCours;
    p.nbPreuves = preuvesValidees; p.graines = graines;
    p.batisseurs = Object.keys(batset).length;
    p.sansPreuve = terminees - prouvees;
    p.vide = (qs.length === 0);

    p.competences = Object.keys(domaines).map(function (d) {
      return { nom: d, n: domaines[d], palier: paliersCompetence(domaines[d]) };
    }).sort(function (a, b) { return b.n - a.n; });

    var c1 = Math.round(pct(prouvees, terminees) * 40);
    var c2 = Math.round(pct(terminees, 8) * 25);
    var c3 = Math.round(pct(preuvesValidees, 10) * 20);
    var c4 = Math.round(pct(p.batisseurs, 5) * 15);
    p.score = Math.max(0, Math.min(100, c1 + c2 + c3 + c4));
    p.niveau = niveauPour(p.score);
    p.suivant = prochainNiveau(p.score);
    p.composantes = [
      { label: 'Quêtes prouvées', val: c1, max: 40, detail: prouvees + ' quête' + (prouvees > 1 ? 's' : '') + ' terminée' + (prouvees > 1 ? 's' : '') + ' avec une preuve validée sur ' + terminees + ' terminée' + (terminees > 1 ? 's' : '') },
      { label: 'Activité',        val: c2, max: 25, detail: terminees + ' quête' + (terminees > 1 ? 's' : '') + ' menée' + (terminees > 1 ? 's' : '') + ' au bout (plafond à 8)' },
      { label: 'Preuves validées', val: c3, max: 20, detail: preuvesValidees + ' preuve' + (preuvesValidees > 1 ? 's' : '') + ' déposée' + (preuvesValidees > 1 ? 's' : '') + ' et validée' + (preuvesValidees > 1 ? 's' : '') + ' (plafond à 10)' },
      { label: 'Communauté',      val: c4, max: 15, detail: p.batisseurs + ' Bâtisseur' + (p.batisseurs > 1 ? 's' : '') + ' venu' + (p.batisseurs > 1 ? 's' : '') + ' sur le lieu (plafond à 5)' }
    ];

    p.recommandations = recommanderPourLieu(lieuId, p);
    return p;
  }

  /* ── Recommandations ───────────────────────────────────────────────── */
  // Bâtisseur : des quêtes ouvertes, choisies d'après ce qu'il a déjà fait.
  function recommanderPourBatisseur(batId, p) {
    var s = st(); if (!s) return [];
    var mesDomaines = {};
    p.competences.forEach(function (c) { mesDomaines[String(c.nom).toLowerCase()] = c.n; });
    var ville = '';
    try { ville = String((global.batFicheData && global.batFicheData.ville) || '').toLowerCase(); } catch (e) {}

    var deja = {};
    s.where('quete_candidatures', function (c) { return c && c.batisseur_id === batId; })
      .forEach(function (c) { if (c.quete_id) deja[c.quete_id] = 1; });

    var ouvertes = s.where('quetes', function (q) { return q && q.statut === 'ouverte' && !deja[q.id]; });
    var notees = ouvertes.map(function (q) {
      var lieu = q.lieu_id ? s.get('lieux', q.lieu_id) : null;
      var dom = String(domaineDeQuete(q)).toLowerCase();
      var n = 0, pourquoi = '';
      if (mesDomaines[dom]) {
        n += 3;
        pourquoi = 'Tu as déjà validé ' + mesDomaines[dom] + ' quête' + (mesDomaines[dom] > 1 ? 's' : '') + ' dans ce domaine.';
      } else if (p.competences.length) {
        n += 1;
        pourquoi = 'Un domaine nouveau pour toi : de quoi élargir ton passeport.';
      } else {
        pourquoi = 'Une première quête pour ouvrir ton passeport.';
      }
      var v = String((lieu && (lieu.localisation || lieu.ville)) || '').toLowerCase();
      if (ville && v && (v.indexOf(ville) >= 0 || ville.indexOf(v) >= 0)) { n += 2; pourquoi += ' Et c’est près de chez toi.'; }
      return {
        srcId: q.id, titre: ou(q.titre, 'Quête'), ic: ou(q.sourceIc, '⚡'),
        lieu: (lieu && lieu.nom) || ou(q.lieu_nom, 'Lieu EVAD'),
        domaine: domaineDeQuete(q), graines: parseInt(q.graines, 10) || 0,
        pourquoi: pourquoi, _n: n
      };
    }).sort(function (a, b) { return b._n - a._n; });
    return notees.slice(0, 3);
  }

  // Lieu : ce qui ferait monter son passeport, dans l'ordre où ça compte.
  function recommanderPourLieu(lieuId, p) {
    var reco = [];
    if (p.sansPreuve > 0) {
      reco.push({
        ic: '📸',
        titre: (p.sansPreuve === 1)
          ? 'Valider la preuve de la quête terminée qui reste'
          : 'Valider les preuves des ' + p.sansPreuve + ' quêtes terminées',
        pourquoi: 'C’est la composante la plus lourde du score : une quête terminée sans preuve validée reste une promesse.'
      });
    }
    if (p.nbTerminees === 0) {
      reco.push({
        ic: '⚡',
        titre: p.nbEnCours ? 'Mener une première quête au bout' : 'Publier une première quête',
        pourquoi: 'Le passeport se construit sur des quêtes terminées, pas sur la fiche du lieu.'
      });
    }
    if (p.batisseurs < 5) {
      reco.push({
        ic: '🤝',
        titre: 'Accueillir de nouveaux Bâtisseurs',
        pourquoi: p.batisseurs + ' Bâtisseur' + (p.batisseurs > 1 ? 's sont venus' : ' est venu') + ' sur le lieu. La composante Communauté se remplit jusqu’à 5.'
      });
    }
    if (p.competences.length < 4 && p.nbTerminees > 0) {
      reco.push({
        ic: '🌱',
        titre: 'Varier les domaines de quêtes',
        pourquoi: 'Un lieu qui prouve son impact sur plusieurs domaines inspire davantage confiance qu’un lieu mono-sujet.'
      });
    }
    return reco.slice(0, 3);
  }

  /* ── Rendu : carte compacte (dans une fiche, un tableau de bord) ────── */
  function carteHtml(kind, id, opts) {
    opts = opts || {};
    var p = (kind === 'lieu') ? passeportLieu(id) : passeportBatisseur(id);
    if (!p || (!id)) return '';
    var n = p.niveau;
    var titre = (kind === 'lieu') ? 'Passeport d’Impact du lieu' : 'Passeport d’Impact';
    var sous = p.vide
      ? 'Aucune quête encore engagée : le passeport s’ouvre à la première.'
      : (p.nbTerminees + ' quête' + (p.nbTerminees > 1 ? 's' : '') + ' terminée' + (p.nbTerminees > 1 ? 's' : '')
         + ' · ' + p.nbPreuves + ' preuve' + (p.nbPreuves > 1 ? 's' : '') + ' validée' + (p.nbPreuves > 1 ? 's' : '')
         + (p.graines ? ' · ' + p.graines + ' graines' : ''));
    return ''
      + '<div onclick="passeportOuvrir(\'' + kind + '\',\'' + esc(id) + '\')" '
      +   'style="cursor:pointer;background:#fff;border:1px solid ' + n.bord + ';border-radius:var(--r-lg);padding:.85rem .95rem;margin-bottom:' + ou(opts.mb, '.9rem') + ';transition:box-shadow .18s" '
      +   'onmouseover="this.style.boxShadow=\'0 6px 18px rgba(46,102,66,.12)\'" onmouseout="this.style.boxShadow=\'\'">'
      +   '<div style="display:flex;align-items:center;gap:.8rem">'
      +     '<div style="width:46px;height:46px;border-radius:12px;background:' + n.bg + ';border:1px solid ' + n.bord + ';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">'
      +       '<div style="font-family:\'Satoshi\',sans-serif;font-size:1.05rem;font-weight:900;color:' + n.col + ';line-height:1">' + p.score + '</div>'
      +       '<div style="font-size:.48rem;color:' + n.col + ';opacity:.7;letter-spacing:.04em">/100</div>'
      +     '</div>'
      +     '<div style="flex:1;min-width:0">'
      +       '<div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">'
      +         '<span style="font-size:.74rem;font-weight:700;color:var(--ink)">🛂 ' + titre + '</span>'
      +         '<span style="font-size:.58rem;font-weight:800;color:' + n.col + ';background:' + n.bg + ';border:1px solid ' + n.bord + ';padding:.1rem .45rem;border-radius:100px">' + n.ic + ' ' + n.label + '</span>'
      +       '</div>'
      +       '<div style="font-size:.62rem;color:var(--moss);opacity:.75;margin-top:.2rem">' + esc(sous) + '</div>'
      +     '</div>'
      +     '<span style="flex-shrink:0;font-size:.7rem;color:var(--moss);opacity:.5">›</span>'
      +   '</div>'
      + '</div>';
  }

  /* ── Rendu : passeport complet (panneau plein écran) ───────────────── */
  function barre(val, max, col) {
    var w = max > 0 ? Math.round((val / max) * 100) : 0;
    return '<div style="height:5px;border-radius:100px;background:rgba(46,102,66,.1);overflow:hidden">'
      + '<div style="height:100%;width:' + w + '%;background:' + col + ';border-radius:100px"></div></div>';
  }

  function ouvrir(kind, id) {
    var p = (kind === 'lieu') ? passeportLieu(id) : passeportBatisseur(id);
    var n = p.niveau;
    fermer();

    var manque = p.suivant ? (p.suivant.min - p.score) : 0;
    var ligneRecolte = (p.score >= 50)
      ? '✅ Passeport reconnu par les commerçants de la Récolte.'
      : (p.suivant ? '🔒 Encore ' + manque + ' point' + (manque > 1 ? 's' : '') + ' avant le niveau ' + p.suivant.label + ', celui qui rend le passeport reconnu par les commerçants de la Récolte.' : '');

    var ov = document.createElement('div');
    ov.id = 'passeport-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:10030;background:rgba(13,43,34,.62);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1.2rem;animation:obFadeIn .25s ease';
    ov.onclick = function (e) { if (e.target === ov) fermer(); };

    var histo = p.quetes.length
      ? p.quetes.map(function (q) {
          return '<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem .55rem;border-radius:9px;background:rgba(46,102,66,.04);margin-bottom:.35rem">'
            + '<span style="font-size:.95rem;flex-shrink:0">' + esc(q.ic) + '</span>'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:.72rem;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(q.titre) + '</div>'
            +   '<div style="font-size:.58rem;color:var(--moss);opacity:.75">📍 ' + esc(q.lieu)
            +     (q.validees ? ' · ✅ ' + q.validees + ' preuve' + (q.validees > 1 ? 's' : '') + ' validée' + (q.validees > 1 ? 's' : '')
                              : ' · <span style="color:var(--terracotta)">preuve à valider</span>')
            +   '</div>'
            + '</div>'
            + (q.graines ? '<div style="flex-shrink:0;font-size:.7rem;font-weight:800;color:var(--amber)">' + q.graines + ' graines</div>' : '')
          + '</div>';
        }).join('')
      : '<div style="font-size:.68rem;color:var(--moss);opacity:.7;padding:.5rem 0">Aucune quête terminée pour l’instant. La première ouvrira l’historique.</div>';

    var comps = p.competences.length
      ? p.competences.map(function (c) {
          return '<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.66rem;font-weight:600;color:var(--forest);background:rgba(74,140,92,.1);border:1px solid rgba(74,140,92,.25);border-radius:100px;padding:.22rem .6rem;margin:0 .3rem .3rem 0">'
            + esc(c.palier) + ' en ' + esc(c.nom) + ' <span style="opacity:.6;font-weight:500">(' + c.n + ')</span></span>';
        }).join('')
      : '<div style="font-size:.68rem;color:var(--moss);opacity:.7">Les domaines apparaissent au fil des quêtes validées.</div>';

    var recos = p.recommandations.length
      ? p.recommandations.map(function (r) {
          var clic = (p.kind === 'batisseur' && r.srcId)
            ? ' onclick="passeportAllerQuete(\'' + esc(r.srcId) + '\')" style="cursor:pointer;'
            : ' style="';
          return '<div' + clic + 'display:flex;align-items:flex-start;gap:.6rem;padding:.55rem .6rem;border:1px solid rgba(58,110,140,.2);background:rgba(58,110,140,.05);border-radius:10px;margin-bottom:.4rem">'
            + '<span style="font-size:.95rem;flex-shrink:0">' + esc(r.ic || '⚡') + '</span>'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:.71rem;font-weight:700;color:var(--ink)">' + esc(r.titre) + '</div>'
            +   '<div style="font-size:.6rem;color:var(--moss);opacity:.8;line-height:1.45;margin-top:.12rem">' + esc(r.pourquoi) + '</div>'
            + '</div>'
            + (r.srcId ? '<span style="flex-shrink:0;font-size:.62rem;color:var(--sky)">›</span>' : '')
          + '</div>';
        }).join('')
      : '<div style="font-size:.68rem;color:var(--moss);opacity:.7">Rien à suggérer pour le moment.</div>';

    ov.innerHTML = ''
      + '<div style="display:flex;flex-direction:column;width:380px;max-width:94vw;max-height:90vh;background:var(--paper);border-radius:var(--r-lg);overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.34);font-family:\'Satoshi\',sans-serif" onclick="event.stopPropagation()">'

      // En-tête
      + '<div style="position:relative;padding:1.1rem 1.2rem;background:linear-gradient(135deg,#0e2a1a,#1a3a22);flex-shrink:0">'
      +   '<button onclick="passeportFermer()" aria-label="Fermer" style="position:absolute;top:.7rem;right:.7rem;background:rgba(255,255,255,.14);border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;font-size:.72rem;color:rgba(255,255,255,.75)">✕</button>'
      +   '<div style="font-size:.56rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,.5);margin-bottom:.5rem">🛂 Passeport d’Impact</div>'
      +   '<div style="display:flex;align-items:center;gap:.9rem">'
      +     '<div style="width:66px;height:66px;border-radius:16px;background:' + n.bg + ';border:1.5px solid ' + n.bord + ';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">'
      +       '<div style="font-size:1.6rem;font-weight:900;color:' + n.col + ';line-height:1">' + p.score + '</div>'
      +       '<div style="font-size:.5rem;color:' + n.col + ';opacity:.75">/ 100</div>'
      +     '</div>'
      +     '<div style="flex:1;min-width:0">'
      +       '<div style="font-size:1.02rem;font-weight:900;color:#fff;line-height:1.2">' + esc(p.nom) + '</div>'
      +       '<div style="font-size:.64rem;color:rgba(255,255,255,.55);margin-top:.15rem">' + (p.kind === 'lieu' ? 'Lieu régénératif' : 'Bâtisseur d’impact') + ' · Vadité vérifiée</div>'
      +       '<div style="display:inline-flex;align-items:center;gap:.3rem;margin-top:.4rem;font-size:.62rem;font-weight:800;color:' + n.col + ';background:' + n.bg + ';border:1px solid ' + n.bord + ';padding:.15rem .55rem;border-radius:100px">' + n.ic + ' Niveau ' + n.label + '</div>'
      +     '</div>'
      +   '</div>'
      +   (ligneRecolte ? '<div style="margin-top:.75rem;font-size:.62rem;color:rgba(255,255,255,.6);line-height:1.45">' + esc(ligneRecolte) + '</div>' : '')
      + '</div>'

      // Corps
      + '<div style="flex:1;overflow-y:auto;min-height:0;padding:1rem 1.2rem 1.2rem">'

      // Score : décomposition
      +   '<div style="font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--moss);opacity:.7;margin-bottom:.5rem">🧮 Comment ce score se calcule</div>'
      +   '<div style="background:#fff;border:1px solid rgba(46,102,66,.12);border-radius:var(--r-lg);padding:.8rem .9rem;margin-bottom:1rem">'
      +     p.composantes.map(function (c) {
              return '<div style="margin-bottom:.6rem">'
                + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;margin-bottom:.25rem">'
                +   '<span style="font-size:.68rem;font-weight:700;color:var(--ink)">' + esc(c.label) + '</span>'
                +   '<span style="font-size:.66rem;font-weight:800;color:' + n.col + '">' + c.val + '<span style="opacity:.5;font-weight:600">/' + c.max + '</span></span>'
                + '</div>'
                + barre(c.val, c.max, n.col)
                + '<div style="font-size:.57rem;color:var(--moss);opacity:.7;margin-top:.22rem;line-height:1.4">' + esc(c.detail) + '</div>'
              + '</div>';
            }).join('')
      +     '<div style="font-size:.57rem;color:var(--moss);opacity:.65;line-height:1.45;border-top:1px solid rgba(46,102,66,.08);padding-top:.5rem">La Vadité ne mesure pas l’intention : chaque point vient d’une quête terminée ou d’une preuve validée par un Pilote.</div>'
      +   '</div>'

      // Historique
      +   '<div style="font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--moss);opacity:.7;margin-bottom:.5rem">📜 Historique'
      +     (p.graines ? ' · ' + p.graines + ' graines' : '') + '</div>'
      +   '<div style="margin-bottom:1rem">' + histo + '</div>'

      // Compétences
      +   '<div style="font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--moss);opacity:.7;margin-bottom:.5rem">🏅 ' + (p.kind === 'lieu' ? 'Domaines prouvés' : 'Compétences') + '</div>'
      +   '<div style="margin-bottom:1rem">' + comps + '</div>'

      // Recommandations
      +   '<div style="font-size:.6rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--moss);opacity:.7;margin-bottom:.5rem">🧭 Pour aller plus loin</div>'
      +   recos
      + '</div>'
      + '</div>';

    document.body.appendChild(ov);
    document.addEventListener('keydown', echap);
  }

  function echap(e) { if (e.key === 'Escape') fermer(); }
  function fermer() {
    var m = document.getElementById('passeport-modal');
    if (m) m.remove();
    document.removeEventListener('keydown', echap);
  }

  // Depuis une recommandation : ouvrir la quête proposée.
  function allerQuete(srcId) {
    fermer();
    try {
      if (typeof global.batBuildQuetesFromProfile === 'function' && global.BAT_QUETES && !global.BAT_QUETES.length) {
        global.batBuildQuetesFromProfile();
      }
      var i = (global.BAT_QUETES || []).findIndex(function (q) { return q.srcId === srcId; });
      if (i >= 0 && typeof global.showQueteDetail === 'function') { global.showQueteDetail(i, 'quete'); return; }
    } catch (e) {}
    if (typeof global.mmBubble === 'function') global.mmBubble('Cette quête n’est pas encore chargée, ouvre l’onglet des quêtes 🌱');
  }

  /* ── Emplacements dans les tableaux de bord ────────────────────────── */
  function remplirSlots() {
    try {
      var sb = document.getElementById('bat-passeport-slot');
      if (sb) {
        var bid = (global.batFicheData && global.batFicheData.id) || null;
        sb.innerHTML = bid ? carteHtml('batisseur', bid, { mb: '1.2rem' }) : '';
      }
    } catch (e) {}
    try {
      var sp = document.getElementById('pilote-passeport-slot');
      if (sp) {
        var lid = (global.myLieuData && global.myLieuData.id) || null;
        sp.innerHTML = lid ? carteHtml('lieu', lid, { mb: '.9rem' }) : '';
      }
    } catch (e) {}
  }

  // Les fiches et les preuves arrivent de Supabase après le premier rendu :
  // on repasse quand elles sont là, sinon le passeport resterait à zéro.
  ['evad:quetes-ready', 'evad:preuves-ready', 'evad:candidatures-ready', 'evad:batisseurs-ready', 'evad:supabase-ready']
    .forEach(function (ev) { global.addEventListener(ev, function () { remplirSlots(); }); });

  global.passeportBatisseur = passeportBatisseur;
  global.passeportLieu = passeportLieu;
  global.passeportCarteHtml = carteHtml;
  global.passeportOuvrir = ouvrir;
  global.passeportFermer = fermer;
  global.passeportAllerQuete = allerQuete;
  global.passeportRemplirSlots = remplirSlots;
})(window);
