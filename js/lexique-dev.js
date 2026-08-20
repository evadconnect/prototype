/* EVAD · lexique-dev.js
   Vocabulaire à l'essai, HORS PRODUCTION UNIQUEMENT.

   Les noms de la monnaie et du marché ne sont pas arrêtés : Vade est devenu
   graines, et l'équipe veut maintenant voir « Vadins » et « Vaderie » à l'écran
   avant de trancher. Plutôt que de réécrire des centaines de chaînes dans tout
   l'applicatif à chaque essai, on traduit à l'affichage : le code continue de
   parler de graines, seul le rendu change.

   Trois précautions :
     - jamais sur app.evad.org, les bêta-testeurs gardent « graines » ;
     - on ne touche QU'AU TEXTE AFFICHÉ, jamais à la valeur d'un champ de
       saisie, sinon on réécrirait ce que la personne est en train d'écrire ;
     - la traduction est idempotente, la repasser ne change rien, ce qui permet
       de la rejouer à chaque rendu sans tenir de registre.

   Le jour où un nom est adopté, ce fichier disparaît et les chaînes sont
   renommées pour de bon. */
(function (global) {
  'use strict';

  // Production : on ne traduit rien.
  try { if (global.EVAD_SUPABASE_ENV && global.EVAD_SUPABASE_ENV.isProd) return; } catch (e) { return; }

  // « récolte » en minuscules est laissé tel quel : c'est un mot courant dans
  // les fiches de la Bibliothèque (récolte d'eau de pluie, récolte de miel),
  // le nom du marché s'écrit avec une majuscule.
  // Vadin est MASCULIN, graine était féminin : les déterminants et les accords
  // qui suivent doivent changer aussi, sinon on lit « une Vadin » ou
  // « Vadins gagnées ». Les déterminants se traitent AVANT la substitution du
  // nom, les participes APRÈS. Seuls les cas réellement présents dans l'app
  // sont couverts, relevés par recherche dans le code.
  var REGLES = [
    // ── Déterminants féminins → masculin ──
    [/\bAucune\s+graine\b/g, 'Aucun Vadin'],
    [/\baucune\s+graine\b/g, 'aucun Vadin'],
    [/\bUne\s+graine\b/g, 'Un Vadin'],
    [/\bune\s+graine\b/g, 'un Vadin'],
    [/\bLa\s+graine\b/g, 'Le Vadin'],
    [/\bla\s+graine\b/g, 'le Vadin'],
    [/\bCette\s+graine\b/g, 'Ce Vadin'],
    [/\bcette\s+graine\b/g, 'ce Vadin'],
    [/\bMa\s+graine\b/g, 'Mon Vadin'],  [/\bma\s+graine\b/g, 'mon Vadin'],
    [/\bTa\s+graine\b/g, 'Ton Vadin'],  [/\bta\s+graine\b/g, 'ton Vadin'],
    [/\bSa\s+graine\b/g, 'Son Vadin'],  [/\bsa\s+graine\b/g, 'son Vadin'],
    [/\bToutes\s+les\s+graines\b/g, 'Tous les Vadins'],
    [/\btoutes\s+les\s+graines\b/g, 'tous les Vadins'],
    [/\bCertaines\s+graines\b/g, 'Certains Vadins'],
    [/\bcertaines\s+graines\b/g, 'certains Vadins'],
    [/\bGRAINES\b/g, 'VADINS'],
    [/\bGRAINE\b/g, 'VADIN'],
    [/\bGraines\b/g, 'Vadins'],
    [/\bGraine\b/g, 'Vadin'],
    [/\bgraines\b/g, 'Vadins'],
    [/\bgraine\b/g, 'Vadin'],
    [/\b[Ll]a\s+Récolte\b/g, 'Vaderie'],
    [/\bLA\s+RÉCOLTE\b/g, 'VADERIE'],
    [/\bRécolte\b/g, 'Vaderie'],
    [/\bRÉCOLTE\b/g, 'VADERIE'],
    // ── Accords qui SUIVENT le nom : « Vadins gagnées » → « Vadins gagnés » ──
    [/\b(Vadins?\s+(?:bloqué|distribué|engagé|gagné|reçu|retourné|dépensé|versé|crédité|gelé))e(s?)\b/g, '$1$2']
  ];

  function traduire(s) {
    if (!s || s.indexOf('rain') < 0 && s.indexOf('écolt') < 0 && s.indexOf('ÉCOLT') < 0 && s.indexOf('RAIN') < 0) return s;
    var out = s;
    for (var i = 0; i < REGLES.length; i++) out = out.replace(REGLES[i][0], REGLES[i][1]);
    return out;
  }

  var IGNORER = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1, SVG: 1 };
  var ATTRIBUTS = ['placeholder', 'title', 'aria-label'];

  function parcourir(racine) {
    if (!racine) return;
    // Texte affiché.
    try {
      var it = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode;
          if (!p || IGNORER[p.nodeName]) return NodeFilter.FILTER_REJECT;
          if (p.isContentEditable) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var n;
      while ((n = it.nextNode())) {
        var t = traduire(n.nodeValue);
        if (t !== n.nodeValue) n.nodeValue = t;
      }
    } catch (e) {}
    // Attributs d'aide à la saisie. La VALEUR d'un champ n'est jamais touchée.
    try {
      var cibles = racine.querySelectorAll ? racine.querySelectorAll('[placeholder],[title],[aria-label]') : [];
      for (var k = 0; k < cibles.length; k++) {
        for (var a = 0; a < ATTRIBUTS.length; a++) {
          var v = cibles[k].getAttribute(ATTRIBUTS[a]);
          if (v == null) continue;
          var w = traduire(v);
          if (w !== v) cibles[k].setAttribute(ATTRIBUTS[a], w);
        }
      }
    } catch (e) {}
  }

  // L'app redessine beaucoup : on repasse après chaque salve de mutations,
  // groupées pour ne pas traduire mille fois pendant un même rendu.
  var enAttente = null;
  function planifier(cible) {
    if (enAttente) return;
    enAttente = setTimeout(function () { enAttente = null; parcourir(cible || document.body); }, 60);
  }

  function demarrer() {
    parcourir(document.body);
    try {
      new MutationObserver(function () { planifier(document.body); })
        .observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();

  global.evadLexiqueDev = { traduire: traduire, rejouer: function () { parcourir(document.body); } };
})(window);
