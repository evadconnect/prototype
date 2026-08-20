/* ─────────────────────────────────────────
   NAVIGATION MOBILE, Barre inférieure
───────────────────────────────────────── */
(function() {
  var ROLE_SCREENS = {
    pilote:    { screen: 'pilote', icon: '📊', label: 'Tableau' },
    batisseur: { screen: 'quete',  icon: '⚡', label: 'Quêtes'  },
    semeur:    { screen: 'semeur', icon: '📋', label: 'RSE'     }
  };

  function getActiveScreen() {
    var el = document.querySelector('.screen.active');
    return el ? el.id.replace('screen-', '') : 'carte';
  }

  // Écrans à assistant par étapes : la barre du bas montre la progression.
  var WIZARD_SCREENS = { 'creer': 1, 'fiche-bat': 1, 'fiche-sem': 1 };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function renderWizardBar(w) {
    return '<div class="mob-wizard">' + w.steps.map(function (label, i) {
      var state = i < w.currentIdx ? 'done' : (i === w.currentIdx ? 'active' : 'upcoming');
      var icon = state === 'done' ? '✓' : (i + 1);
      var onclick = (i < w.currentIdx) ? ' onclick="navWizardJump(' + i + ')"' : '';
      return '<button class="mob-wstep ' + state + '"' + onclick
        + ' aria-label="Étape ' + (i + 1) + ' : ' + esc(label) + '"'
        + (i === w.currentIdx ? ' aria-current="step"' : '') + '>'
        + '<span class="mob-wcircle">' + icon + '</span>'
        + '<span class="mob-wlabel">' + esc(label) + '</span>'
        + '</button>';
    }).join('') + '</div>';
  }

  function renderMobNav() {
    var nav = document.getElementById('mob-nav');
    if (!nav) return;
    var active = getActiveScreen();
    // En mode assistant (création de lieu, fiche), la barre affiche les étapes
    // à la place des onglets — comme le stepper de la sidebar sur desktop.
    if (WIZARD_SCREENS[active] && window._navWizard && window._navWizard.steps && window._navWizard.steps.length) {
      nav.classList.add('mob-nav-wizard');
      nav.innerHTML = renderWizardBar(window._navWizard);
      return;
    }
    nav.classList.remove('mob-nav-wizard');
    var role = (typeof currentRole !== 'undefined' ? currentRole : null) || 'pilote';
    var rs = ROLE_SCREENS[role] || ROLE_SCREENS.pilote;
    var active = getActiveScreen();
    var items = [
      { screen: 'carte',       icon: '🗺',    label: 'Carte'  },
      { screen: rs.screen,     icon: rs.icon, label: rs.label },
      { screen: 'bdd',         icon: '📚',    label: 'Biblio' },
      { screen: 'marketplace', icon: '🤲',    label: 'Récolte' },
      { deva: true,            icon: '✦',     label: 'Deva'   }
    ];
    nav.innerHTML = items.map(function(item) {
      if (item.deva) {
        return '<button class="mob-btn mob-deva" onclick="devaToggleChat()" aria-label="Ouvrir Deva">'
          + '<span class="mob-btn-icon">' + item.icon + '</span>' + item.label + '</button>';
      }
      var cls = 'mob-btn' + (item.screen === active ? ' active' : '');
      return '<button class="' + cls + '" onclick="showScreen(\'' + item.screen + '\')" aria-label="' + item.label + '">'
        + '<span class="mob-btn-icon">' + item.icon + '</span>' + item.label + '</button>';
    }).join('');
  }

  window.renderMobNav = renderMobNav;   // appelée aussi par navWizardSet (app-core)

  document.addEventListener('DOMContentLoaded', function() {
    var nav = document.createElement('div');
    nav.id = 'mob-nav';
    document.body.appendChild(nav);

    /* Patch showScreen → met à jour la nav */
    var _show = window.showScreen;
    window.showScreen = function(id) { _show(id); renderMobNav(); };

    renderMobNav();
  });
})();
