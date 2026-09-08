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

    var domaines = {}, lieux = {};
    var terminees = 0, enCours = 0, prouvees = 0, preuvesValidees = 0, graines = 0, avantApres = 0;

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
        // Une quête documentée avant ET après : c'est la preuve la plus solide,
        // elle mérite son badge.
        if (val.some(function (x) { return x.phase === 't0'; }) &&
            val.some(function (x) { return x.phase === 't1'; })) avantApres++;
        var d = domaineDeQuete(q);
        domaines[d] = (domaines[d] || 0) + 1;
        lieux[(lieu && lieu.nom) || ou(q.lieu_nom, 'Lieu EVAD')] = 1;
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
    p.lieux = Object.keys(lieux).length;
    p.avantApres = avantApres;
    p.sansPreuve = terminees - prouvees;
    p.vide = (terminees === 0 && enCours === 0);

    // Compétences : les domaines pratiqués, du plus au moins fréquent.
    p.competences = Object.keys(domaines).map(function (d) {
      return { nom: d, n: domaines[d], palier: paliersCompetence(domaines[d]) };
    }).sort(function (a, b) { return b.n - a.n; });
    p.maxDomaine = p.competences.length ? p.competences[0].n : 0;

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
    var terminees = 0, enCours = 0, prouvees = 0, preuvesValidees = 0, graines = 0, avantApres = 0;

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
        if (val.some(function (x) { return x.phase === 't0'; }) &&
            val.some(function (x) { return x.phase === 't1'; })) avantApres++;
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
    p.avantApres = avantApres;
    p.nbQuetesPubliees = qs.length;
    p.vide = (qs.length === 0);

    p.competences = Object.keys(domaines).map(function (d) {
      return { nom: d, n: domaines[d], palier: paliersCompetence(domaines[d]) };
    }).sort(function (a, b) { return b.n - a.n; });
    p.maxDomaine = p.competences.length ? p.competences[0].n : 0;

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

  /* ── Badges à collectionner ────────────────────────────────────────
     Chaque badge est une condition vérifiable, jamais un encouragement
     décoratif : on affiche la progression réelle, y compris quand il reste
     loin à parcourir. C'est ce qui rend la collection crédible, et ce qui la
     rend motivante — on sait exactement ce qu'il manque. */
  var BADGES_BATISSEUR = [
    { id:'premiere',  ic:'🌱', nom:'Première quête',    desc:'Mener une première quête jusqu’au bout.',                       cible:1,   val:function(p){ return p.nbTerminees; } },
    { id:'preuve',    ic:'📸', nom:'Première preuve',   desc:'Faire valider une preuve par un Pilote.',                       cible:1,   val:function(p){ return p.nbPreuves; } },
    { id:'regulier',  ic:'🔁', nom:'Régulier',          desc:'Trois quêtes terminées.',                                       cible:3,   val:function(p){ return p.nbTerminees; } },
    { id:'confirme',  ic:'🏗', nom:'Bâtisseur confirmé', desc:'Six quêtes terminées.',                                        cible:6,   val:function(p){ return p.nbTerminees; } },
    { id:'expert',    ic:'🎓', nom:'Expert d’un domaine', desc:'Quatre quêtes validées dans le même domaine.',                cible:4,   val:function(p){ return p.maxDomaine; } },
    { id:'polyvalent',ic:'🌈', nom:'Polyvalent',        desc:'Trois domaines de compétence différents.',                      cible:3,   val:function(p){ return p.competences.length; } },
    { id:'explorateur',ic:'🧭', nom:'Explorateur',      desc:'Intervenir sur trois lieux différents.',                        cible:3,   val:function(p){ return p.lieux; } },
    { id:'avantapres',ic:'🔎', nom:'Avant / après',     desc:'Une quête documentée à l’état initial et à l’état final.',      cible:1,   val:function(p){ return p.avantApres; } },
    { id:'sansfaute', ic:'✅', nom:'Sans faute',        desc:'Toutes tes quêtes terminées ont une preuve validée (2 minimum).', cible:1, val:function(p){ return (p.nbTerminees >= 2 && p.sansPreuve === 0) ? 1 : 0; } },
    { id:'recolte',   ic:'🌾', nom:'Belle récolte',     desc:'200 graines reçues en reconnaissance.',                         cible:200, val:function(p){ return p.graines; } },
    { id:'bronze',    ic:'🥉', nom:'Passeport Bronze',  desc:'Atteindre 50 points de Vadité.',                                cible:50,  val:function(p){ return p.score; } },
    { id:'argent',    ic:'🥈', nom:'Passeport Argent',  desc:'Atteindre 70 points de Vadité.',                                cible:70,  val:function(p){ return p.score; } },
    { id:'or',        ic:'🥇', nom:'Passeport Or',      desc:'Atteindre 90 points de Vadité.',                                cible:90,  val:function(p){ return p.score; } }
  ];

  var BADGES_LIEU = [
    { id:'ouverture',  ic:'⚡', nom:'Lieu ouvert',       desc:'Publier une première quête.',                                  cible:1,   val:function(p){ return p.nbQuetesPubliees; } },
    { id:'premiere',   ic:'🌱', nom:'Première quête menée', desc:'Une quête terminée sur le lieu.',                           cible:1,   val:function(p){ return p.nbTerminees; } },
    { id:'preuve',     ic:'📸', nom:'Première preuve',   desc:'Une preuve validée sur le lieu.',                              cible:1,   val:function(p){ return p.nbPreuves; } },
    { id:'accueil',    ic:'🤝', nom:'Terre d’accueil',   desc:'Cinq Bâtisseurs venus sur le lieu.',                           cible:5,   val:function(p){ return p.batisseurs; } },
    { id:'cadence',    ic:'🔁', nom:'Bonne cadence',     desc:'Cinq quêtes terminées.',                                       cible:5,   val:function(p){ return p.nbTerminees; } },
    { id:'domaines',   ic:'🌈', nom:'Impact multiple',   desc:'Trois domaines prouvés sur le lieu.',                          cible:3,   val:function(p){ return p.competences.length; } },
    { id:'avantapres', ic:'🔎', nom:'Avant / après',     desc:'Une quête documentée à l’état initial et à l’état final.',     cible:1,   val:function(p){ return p.avantApres; } },
    { id:'transparent',ic:'✅', nom:'Transparent',       desc:'Toutes les quêtes terminées ont une preuve validée (2 minimum).', cible:1, val:function(p){ return (p.nbTerminees >= 2 && p.sansPreuve === 0) ? 1 : 0; } },
    { id:'genereux',   ic:'🌾', nom:'Lieu généreux',     desc:'500 graines distribuées en reconnaissance.',                   cible:500, val:function(p){ return p.graines; } },
    { id:'bronze',     ic:'🥉', nom:'Passeport Bronze',  desc:'Atteindre 50 points de Vadité.',                               cible:50,  val:function(p){ return p.score; } },
    { id:'argent',     ic:'🥈', nom:'Passeport Argent',  desc:'Atteindre 70 points de Vadité.',                               cible:70,  val:function(p){ return p.score; } },
    { id:'or',         ic:'🥇', nom:'Passeport Or',      desc:'Atteindre 90 points de Vadité.',                               cible:90,  val:function(p){ return p.score; } }
  ];

  function badgesPour(p) {
    var liste = (p.kind === 'lieu') ? BADGES_LIEU : BADGES_BATISSEUR;
    return liste.map(function (b) {
      var v = 0;
      try { v = b.val(p) || 0; } catch (e) {}
      return {
        id: b.id, ic: b.ic, nom: b.nom, desc: b.desc,
        val: Math.min(v, b.cible), cible: b.cible, obtenu: v >= b.cible
      };
    });
  }

  /* ── Rendu : bouton d'accès (même bouton que la fiche pilote) ──────────
     Le passeport s'ouvre par un bouton vert, comme « Voir la fiche complète »
     du Pilote, plutôt que par une carte cliquable. */
  function boutonHtml(kind, id, opts) {
    opts = opts || {};
    if (!id) return '';
    var label = opts.label || 'Voir le passeport →';
    return '<button class="acteur-cta" style="background:var(--forest);color:white;margin-top:' + ou(opts.mt, '.6rem') + ';margin-bottom:' + ou(opts.mb, '0') + '" '
      + 'onclick="passeportOuvrir(\'' + (kind === 'lieu' ? 'lieu' : 'batisseur') + '\',\'' + esc(id) + '\')">🛂 ' + label + '</button>';
  }

  /* ── Rendu : carte compacte (dans une fiche, un tableau de bord) ────── */
  function carteHtml(kind, id, opts) {
    opts = opts || {};
    var p = (kind === 'lieu') ? passeportLieu(id) : passeportBatisseur(id);
    if (!p || (!id)) return '';
    var n = p.niveau;
    var titre = (kind === 'lieu') ? 'Passeport d’Impact du lieu' : 'Passeport d’Impact';
    var bg = badgesPour(p);
    var obtenus = bg.filter(function (b) { return b.obtenu; }).length;
    var sous = p.vide
      ? 'Aucune quête encore engagée : le livret s’ouvre à la première.'
      : (p.nbTerminees + ' quête' + (p.nbTerminees > 1 ? 's' : '') + ' terminée' + (p.nbTerminees > 1 ? 's' : '')
         + ' · ' + p.nbPreuves + ' preuve' + (p.nbPreuves > 1 ? 's' : '') + ' validée' + (p.nbPreuves > 1 ? 's' : '')
         + ' · 🎖 ' + obtenus + '/' + bg.length + ' badges');
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
      +         '<span style="font-size:.74rem;font-weight:700;color:var(--ink)">' + titre + '</span>'
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

  /* ── Le livret ─────────────────────────────────────────────────────
     Un passeport se feuillette : page d'identité, planche de badges,
     tampons des quêtes, puis la suite du voyage. Les quatre pages glissent
     dans le même cadre plutôt que de s'empiler dans un long défilement, pour
     qu'on ait en main un objet et pas une fiche de plus. */
  var _courant = null;   // { p, badges, page } du livret ouvert

  // Numéro de livret : dérivé de l'identifiant, donc stable d'une ouverture à
  // l'autre. Décoratif, mais un passeport sans numéro n'en est pas un.
  function numeroLivret(id) {
    var h = 0, str = String(id || '');
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    var n = Math.abs(h).toString(36).toUpperCase();
    while (n.length < 6) n = '0' + n;
    return 'EV-' + n.slice(0, 6);
  }

  // Corps de l'onglet Identité : l'identité et les chiffres-clés sont désormais
  // portés par le héros du modal (comme la fiche pilote), on ne garde ici que
  // la manière dont le score se calcule et la ligne d'identification.
  function pageIdentite(p) {
    var mrz = (String(p.nom).toUpperCase().replace(/[^A-Z0-9]+/g, '<') + '<<<<<<<<<<<<<<<<<<<<').slice(0, 26)
      + '<' + p.niveau.label.toUpperCase().slice(0, 6) + '<' + ('00' + p.score).slice(-3);

    return ''
      + '<div style="font-size:.56rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--moss);opacity:.6;margin-bottom:.45rem">🧮 Comment ce score se calcule</div>'
      + '<div style="background:#fff;border:1px solid rgba(46,102,66,.12);border-radius:12px;padding:.75rem .85rem;margin-bottom:.8rem">'
      +   p.composantes.map(function (c) {
            return '<div style="margin-bottom:.55rem">'
              + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;margin-bottom:.22rem">'
              +   '<span style="font-size:.66rem;font-weight:700;color:var(--ink)">' + esc(c.label) + '</span>'
              +   '<span style="font-size:.64rem;font-weight:800;color:' + p.niveau.col + '">' + c.val + '<span style="opacity:.5;font-weight:600">/' + c.max + '</span></span>'
              + '</div>'
              + barre(c.val, c.max, p.niveau.col)
              + '<div style="font-size:.55rem;color:var(--moss);opacity:.7;margin-top:.2rem;line-height:1.4">' + esc(c.detail) + '</div>'
            + '</div>';
          }).join('')
      +   '<div style="font-size:.55rem;color:var(--moss);opacity:.65;line-height:1.45;border-top:1px solid rgba(46,102,66,.08);padding-top:.45rem">La Vadité ne mesure pas l’intention : chaque point vient d’une quête terminée ou d’une preuve validée par un Pilote.</div>'
      + '</div>'

      + '<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.58rem;letter-spacing:.08em;color:var(--moss);opacity:.45;background:rgba(46,102,66,.05);border-radius:6px;padding:.4rem .5rem;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(mrz) + '</div>';
  }

  function pageBadges(p, n) {
    var tuiles = n.badges.map(function (b) {
      var tour = b.obtenu ? p.niveau.bord : 'rgba(46,102,66,.14)';
      var fond = b.obtenu ? p.niveau.bg : 'rgba(46,102,66,.03)';
      return '<button type="button" onclick="passeportBadgeInfo(\'' + b.id + '\')" '
        + 'style="font-family:inherit;cursor:pointer;text-align:center;padding:.55rem .3rem;border-radius:12px;border:1.5px ' + (b.obtenu ? 'solid' : 'dashed') + ' ' + tour + ';background:' + fond + '">'
        + '<div style="font-size:1.5rem;line-height:1.1;' + (b.obtenu ? '' : 'filter:grayscale(1);opacity:.4') + '">' + b.ic + '</div>'
        + '<div style="font-size:.54rem;font-weight:700;color:' + (b.obtenu ? 'var(--ink)' : 'var(--moss)') + ';opacity:' + (b.obtenu ? '1' : '.6') + ';margin-top:.22rem;line-height:1.25">' + esc(b.nom) + '</div>'
        + (b.obtenu
            ? '<div style="font-size:.5rem;font-weight:800;color:' + p.niveau.col + ';margin-top:.15rem">OBTENU</div>'
            : '<div style="font-size:.5rem;color:var(--moss);opacity:.55;margin-top:.15rem">' + b.val + ' / ' + b.cible + '</div>')
      + '</button>';
    }).join('');

    return ''
      + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;margin-bottom:.5rem">'
      +   '<div style="font-size:.72rem;font-weight:800;color:var(--ink)">🎖 Ma collection</div>'
      +   '<div style="font-size:.62rem;font-weight:800;color:' + p.niveau.col + '">' + n.obtenus + ' / ' + n.badges.length + '</div>'
      + '</div>'
      + '<div style="height:6px;border-radius:100px;background:rgba(46,102,66,.1);overflow:hidden;margin-bottom:.8rem">'
      +   '<div style="height:100%;width:' + Math.round(n.obtenus / n.badges.length * 100) + '%;background:' + p.niveau.col + ';border-radius:100px"></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.45rem;margin-bottom:.7rem">' + tuiles + '</div>'
      + '<div id="passeport-badge-info" style="font-size:.62rem;color:var(--moss);line-height:1.5;background:#fff;border:1px solid rgba(46,102,66,.12);border-radius:12px;padding:.6rem .7rem">'
      +   'Touche un badge pour savoir comment il se décroche.'
      + '</div>';
  }

  function pageTampons(p) {
    var tampons = p.quetes.length
      ? p.quetes.map(function (q, i) {
          var incline = (i % 3 === 0) ? '-1.4deg' : (i % 3 === 1 ? '1.1deg' : '-.5deg');
          var valide = q.validees > 0;
          var col = valide ? 'var(--fern)' : 'var(--moss)';
          return '<div style="position:relative;transform:rotate(' + incline + ');background:#fff;border:1.5px dashed ' + (valide ? 'rgba(74,140,92,.5)' : 'rgba(46,102,66,.2)') + ';border-radius:12px;padding:.6rem .7rem;margin-bottom:.55rem">'
            + '<div style="display:flex;align-items:center;gap:.6rem">'
            +   '<span style="font-size:1.2rem;flex-shrink:0">' + esc(q.ic) + '</span>'
            +   '<div style="flex:1;min-width:0">'
            +     '<div style="font-size:.72rem;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(q.titre) + '</div>'
            +     '<div style="font-size:.56rem;color:var(--moss);opacity:.75;margin-top:.08rem">📍 ' + esc(q.lieu) + ' · ' + esc(q.domaine) + '</div>'
            +   '</div>'
            +   (q.graines ? '<div style="flex-shrink:0;font-size:.68rem;font-weight:800;color:var(--amber)">' + q.graines + ' graines</div>' : '')
            + '</div>'
            + '<div style="margin-top:.35rem;font-size:.53rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:' + col + ';opacity:' + (valide ? '.85' : '.5') + '">'
            +   (valide ? '✔ Validé · ' + q.validees + ' preuve' + (q.validees > 1 ? 's' : '') : '◌ Preuve en attente')
            + '</div>'
          + '</div>';
        }).join('')
      : '<div style="font-size:.66rem;color:var(--moss);opacity:.7;text-align:center;padding:1.4rem .6rem;border:1.5px dashed rgba(46,102,66,.2);border-radius:12px">Aucun tampon pour l’instant.<br>La première quête terminée ouvre le livret.</div>';

    var comps = p.competences.length
      ? p.competences.map(function (c) {
          return '<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.63rem;font-weight:600;color:var(--forest);background:rgba(74,140,92,.1);border:1px solid rgba(74,140,92,.25);border-radius:100px;padding:.2rem .55rem;margin:0 .28rem .28rem 0">'
            + esc(c.palier) + ' en ' + esc(c.nom) + ' <span style="opacity:.6;font-weight:500">(' + c.n + ')</span></span>';
        }).join('')
      : '<div style="font-size:.63rem;color:var(--moss);opacity:.7">Les domaines apparaissent au fil des quêtes validées.</div>';

    return ''
      + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:.5rem;margin-bottom:.6rem">'
      +   '<div style="font-size:.72rem;font-weight:800;color:var(--ink)">📮 Tampons</div>'
      +   (p.graines ? '<div style="font-size:.62rem;font-weight:800;color:var(--amber)">' + p.graines + ' graines</div>' : '')
      + '</div>'
      + tampons
      + '<div style="font-size:.56rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--moss);opacity:.6;margin:.9rem 0 .45rem">🏅 ' + (p.kind === 'lieu' ? 'Domaines prouvés' : 'Compétences') + '</div>'
      + comps;
  }

  function pageSuite(p) {
    var manque = p.suivant ? (p.suivant.min - p.score) : 0;
    var recos = p.recommandations.length
      ? p.recommandations.map(function (r) {
          var clic = (p.kind === 'batisseur' && r.srcId)
            ? ' onclick="passeportAllerQuete(\'' + esc(r.srcId) + '\')" style="cursor:pointer;'
            : ' style="';
          return '<div' + clic + 'display:flex;align-items:flex-start;gap:.6rem;padding:.6rem .65rem;border:1px solid rgba(58,110,140,.2);background:rgba(58,110,140,.05);border-radius:12px;margin-bottom:.45rem">'
            + '<span style="font-size:1rem;flex-shrink:0">' + esc(r.ic || '⚡') + '</span>'
            + '<div style="flex:1;min-width:0">'
            +   '<div style="font-size:.71rem;font-weight:700;color:var(--ink)">' + esc(r.titre) + '</div>'
            +   '<div style="font-size:.6rem;color:var(--moss);opacity:.8;line-height:1.45;margin-top:.12rem">' + esc(r.pourquoi) + '</div>'
            + '</div>'
            + (r.srcId ? '<span style="flex-shrink:0;font-size:.62rem;color:var(--sky)">›</span>' : '')
          + '</div>';
        }).join('')
      : '<div style="font-size:.63rem;color:var(--moss);opacity:.7">Rien à suggérer pour le moment.</div>';

    var visa = (p.score >= 50)
      ? '<div style="border:1.5px solid rgba(74,140,92,.45);background:rgba(74,140,92,.07);border-radius:12px;padding:.7rem .8rem;margin-bottom:.85rem">'
        + '<div style="font-size:.55rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--fern)">✅ Visa Récolte</div>'
        + '<div style="font-size:.63rem;color:var(--moss);line-height:1.5;margin-top:.2rem">Ce passeport est reconnu par les commerçants de la Récolte : le niveau ' + p.niveau.label + ' vaut lettre de confiance.</div>'
      + '</div>'
      : '<div style="border:1.5px dashed rgba(46,102,66,.28);border-radius:12px;padding:.7rem .8rem;margin-bottom:.85rem">'
        + '<div style="font-size:.55rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--moss);opacity:.7">🔒 Visa Récolte</div>'
        + '<div style="font-size:.63rem;color:var(--moss);line-height:1.5;margin-top:.2rem">Encore ' + manque + ' point' + (manque > 1 ? 's' : '') + ' avant le niveau ' + (p.suivant ? p.suivant.label : 'Bronze') + ', celui qui fait reconnaître ce passeport par les commerçants de la Récolte.</div>'
      + '</div>';

    return visa
      + '<div style="font-size:.72rem;font-weight:800;color:var(--ink);margin-bottom:.5rem">🧭 La suite du voyage</div>'
      + recos;
  }

  // Modal du passeport, présenté comme la fiche pilote (le modal de lieu) :
  // même trame — voile sombre défilant, héros vert avec halos, en-tête acteur,
  // barre d'onglets verte collée au héros — et les quatre sections en onglets
  // plutôt qu'en pages qui glissent.
  function ouvrir(kind, id) {
    var p = (kind === 'lieu') ? passeportLieu(id) : passeportBatisseur(id);
    var badges = badgesPour(p);
    var n = { badges: badges, obtenus: badges.filter(function (b) { return b.obtenu; }).length };
    _courant = { p: p, badges: badges, page: 0 };
    fermer();

    var ONGLETS = [
      { ic: '🪪', lbl: 'Identité', html: pageIdentite(p) },
      { ic: '🎖', lbl: 'Badges',   html: pageBadges(p, n) },
      { ic: '📮', lbl: 'Tampons',  html: pageTampons(p) },
      { ic: '🧭', lbl: 'Suite',    html: pageSuite(p) }
    ];
    var qOuv = p.nbEnCours, qFin = p.nbTerminees;
    var sousTitre = (p.kind === 'lieu' ? 'Lieu régénératif' : 'Bâtisseur d’impact') + ' · Vadité vérifiée';

    // Tuile de statistique du bandeau héros (même esprit que la fiche lieu).
    var tuile = function (val, lbl, col) {
      return '<div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(74,140,92,0.3);border-radius:var(--r-lg);padding:.55rem .3rem;text-align:center">'
        + '<div style="font-family:\'Satoshi\',sans-serif;font-size:1.25rem;font-weight:900;color:' + col + ';line-height:1">' + val + '</div>'
        + '<div style="font-size:.5rem;color:var(--sage);text-transform:uppercase;letter-spacing:.09em;margin-top:.2rem">' + lbl + '</div>'
      + '</div>';
    };

    var ov = document.createElement('div');
    ov.id = 'passeport-modal';
    // Voile identique à la fiche pilote : blur léger, défilement de tout le modal.
    ov.style.cssText = 'position:fixed;inset:0;z-index:10030;background:rgba(13,43,34,0.65);backdrop-filter:blur(4px);overflow-y:auto;padding:2rem 1rem;animation:obFadeIn .25s ease';
    ov.onclick = function (e) { if (e.target === ov) fermer(); };

    ov.innerHTML = ''
      + '<div style="max-width:600px;margin:0 auto;border-radius:var(--r-xl);overflow:hidden;box-shadow:0 24px 60px rgba(13,43,34,0.4);position:relative;font-family:\'Satoshi\',sans-serif" onclick="event.stopPropagation()">'

      // ── Héros vert, pleine largeur, avec halos (comme la fiche pilote) ──
      +   '<div style="background:linear-gradient(160deg,#0e2a1a 0%,#1c3d28 55%,#162a20 100%);padding:1.7rem 1.8rem 1.4rem;position:relative;overflow:hidden">'
      +     '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 78% 18%,rgba(74,140,92,0.35) 0%,transparent 55%),radial-gradient(ellipse at 15% 85%,rgba(200,115,42,0.18) 0%,transparent 45%);pointer-events:none"></div>'
      +     '<div style="position:relative">'
      +       '<button onclick="passeportFermer()" aria-label="Fermer le passeport" style="position:absolute;top:-.3rem;right:-.3rem;background:rgba(255,255,255,0.12);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:.85rem;color:rgba(255,255,255,0.8);display:flex;align-items:center;justify-content:center;z-index:2">✕</button>'

      // En-tête acteur : sceau de score en guise d'avatar
      +       '<div style="display:flex;gap:1rem;align-items:flex-start;margin-bottom:1.1rem">'
      +         '<div style="width:60px;height:60px;border-radius:var(--r-lg);background:' + p.niveau.bg + ';border:1.5px solid ' + p.niveau.bord + ';display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 18px rgba(0,0,0,0.28)">'
      +           '<div style="font-family:\'Satoshi\',sans-serif;font-size:1.5rem;font-weight:900;color:' + p.niveau.col + ';line-height:1">' + p.score + '</div>'
      +           '<div style="font-size:.44rem;color:' + p.niveau.col + ';opacity:.8;letter-spacing:.08em">VADITÉ/100</div>'
      +         '</div>'
      +         '<div style="flex:1;min-width:0">'
      +           '<div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-bottom:.45rem">'
      +             '<span class="acteur-badge" style="background:' + p.niveau.bg + ';color:' + p.niveau.col + ';border:1px solid ' + p.niveau.bord + '">' + p.niveau.ic + ' Niveau ' + p.niveau.label + '</span>'
      +             '<span class="acteur-badge" style="background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.65);border:1px solid rgba(255,255,255,0.12)">🎖 ' + n.obtenus + '/' + badges.length + ' badges</span>'
      +           '</div>'
      +           '<div class="acteur-name">' + esc(p.nom) + '</div>'
      +           '<div class="acteur-sub">' + sousTitre + '</div>'
      +           '<div style="font-size:.55rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:rgba(255,255,255,.35);margin-top:.3rem">Passeport d’Impact · ' + numeroLivret(id) + '</div>'
      +         '</div>'
      +       '</div>'

      // Bandeau de statistiques
      +       '<div style="display:flex;gap:.5rem">'
      +         tuile(qFin, 'Quêtes ✓', 'var(--sun)')
      +         tuile(p.nbPreuves, 'Preuves', '#82b894')
      +         tuile(qOuv, 'En cours', '#6aa0bc')
      +       '</div>'
      +     '</div>'
      +   '</div>'

      // ── Barre d'onglets verte, collée au héros (mêmes classes que la fiche lieu) ──
      +   '<div style="background:var(--forest);border-bottom:1px solid rgba(74,140,92,0.2);display:flex;gap:0;padding:0 1rem;position:sticky;top:0;z-index:6;overflow-x:auto">'
      +     ONGLETS.map(function (o, i) {
              return '<button type="button" class="lieu-tab' + (i === 0 ? ' active' : '') + '" id="passeport-onglet-' + i + '" onclick="passeportPage(' + i + ')">' + o.ic + ' ' + o.lbl + '</button>';
            }).join('')
      +   '</div>'

      // ── Corps : un panneau par onglet, seul l'actif est visible ──
      +   '<div style="background:var(--paper)">'
      +     ONGLETS.map(function (o, i) {
              return '<div class="pass-panel" id="passeport-panel-' + i + '" style="display:' + (i === 0 ? 'block' : 'none') + ';padding:1.4rem 1.6rem">' + o.html + '</div>';
            }).join('')
      +   '</div>'
      + '</div>';

    document.body.appendChild(ov);
    document.addEventListener('keydown', echap);
  }

  // Changer d'onglet : on affiche le panneau correspondant et on met l'onglet
  // en avant, exactement comme lieuTab pour la fiche pilote. Les flèches du
  // clavier fonctionnent aussi.
  function page(i) {
    if (!_courant) return;
    i = Math.max(0, Math.min(3, i));
    _courant.page = i;
    for (var k = 0; k < 4; k++) {
      var panneau = document.getElementById('passeport-panel-' + k);
      if (panneau) panneau.style.display = (k === i) ? 'block' : 'none';
      var onglet = document.getElementById('passeport-onglet-' + k);
      if (onglet) onglet.classList.toggle('active', k === i);
    }
    var m = document.getElementById('passeport-modal');
    if (m) m.scrollTop = 0;
  }

  // Détail d'un badge, sous la planche : ce qu'il faut faire pour l'obtenir,
  // et où l'on en est.
  function badgeInfo(badgeId) {
    if (!_courant) return;
    var b = null;
    _courant.badges.forEach(function (x) { if (x.id === badgeId) b = x; });
    var zone = document.getElementById('passeport-badge-info');
    if (!b || !zone) return;
    zone.innerHTML = '<div style="font-size:.68rem;font-weight:800;color:var(--ink);margin-bottom:.15rem">' + b.ic + ' ' + esc(b.nom) + '</div>'
      + '<div style="line-height:1.5">' + esc(b.desc) + '</div>'
      + '<div style="margin-top:.4rem;font-size:.6rem;font-weight:700;color:' + (b.obtenu ? _courant.p.niveau.col : 'var(--moss)') + '">'
      +   (b.obtenu ? '✔ Badge obtenu' : 'Progression : ' + b.val + ' / ' + b.cible)
      + '</div>';
  }

  function echap(e) {
    if (e.key === 'Escape') { fermer(); return; }
    if (!_courant) return;
    if (e.key === 'ArrowRight') page(_courant.page + 1);
    if (e.key === 'ArrowLeft')  page(_courant.page - 1);
  }
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
        sb.innerHTML = bid ? boutonHtml('batisseur', bid, { label: 'Voir mon passeport →', mt: '0', mb: '1.2rem' }) : '';
      }
    } catch (e) {}
    // Le passeport de lieu (côté Pilote) a été retiré : seuls les Bâtisseurs
    // ont un passeport. Le slot du tableau de bord Pilote reste vide.
  }

  // Les fiches et les preuves arrivent de Supabase après le premier rendu :
  // on repasse quand elles sont là, sinon le passeport resterait à zéro.
  ['evad:quetes-ready', 'evad:preuves-ready', 'evad:candidatures-ready', 'evad:batisseurs-ready', 'evad:supabase-ready']
    .forEach(function (ev) { global.addEventListener(ev, function () { remplirSlots(); }); });

  global.passeportBatisseur = passeportBatisseur;
  global.passeportLieu = passeportLieu;
  global.passeportCarteHtml = carteHtml;
  global.passeportBoutonHtml = boutonHtml;
  global.passeportOuvrir = ouvrir;
  global.passeportPage = page;
  global.passeportBadgeInfo = badgeInfo;
  global.passeportFermer = fermer;
  global.passeportAllerQuete = allerQuete;
  global.passeportRemplirSlots = remplirSlots;
})(window);
