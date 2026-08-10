let _authSelectedRole = null;
let _authMode = 'login'; // 'login' | 'signup'

function openAuthModal(){
  _authMode = 'login';
  document.getElementById('auth-profil-title').textContent = 'Choisir un profil';
  document.getElementById('auth-profil-sub').textContent = 'Sélectionnez votre rôle EVAD avant de vous connecter.';
  const m=document.getElementById('auth-profil-modal');
  m.style.display='flex';
}

// Connexion directe pour les personnes DÉJÀ inscrites : ouvre le formulaire
// email + mot de passe sans passer par le choix de profil (le rôle est repris
// des métadonnées du compte à la connexion).
function openLoginModal(){
  _authMode = 'login';
  _authSelectedRole = null;
  const h2 = document.querySelector('#auth-connexion-modal h2');
  if (h2) h2.textContent = 'Se connecter';
  const submit = document.getElementById('auth-submit-btn');
  if (submit) submit.textContent = 'Se connecter';
  const modeBtn = document.getElementById('auth-mode-btn');
  if (modeBtn) modeBtn.textContent = "Pas encore de compte ? S'inscrire";
  const badge = document.getElementById('auth-role-badge');
  if (badge) badge.innerHTML = '🌿 Déjà inscrit·e';
  const err = document.getElementById('auth-error');
  if (err) err.style.display = 'none';
  const email = document.getElementById('auth-email'); if (email) email.value = '';
  const pass = document.getElementById('auth-password'); if (pass) pass.value = '';
  document.getElementById('auth-connexion-modal').style.display = 'flex';
}

// Cœur de connexion partagé (formulaire d'accueil + modal). Sur succès,
// route vers l'onboarding du bon profil (rôle repris des métadonnées du compte).
async function evadLoginCore(email, password, onError, btn, btnLabel){
  const client = window.evadSupabase;
  if (!client) return onError('Connexion Supabase indisponible.');
  if (!email || password.length < 6) return onError('Saisissez un email et un mot de passe de 6 caractères minimum.');
  if (btn) { btn.disabled = true; btn.textContent = 'Patiente…'; }
  try {
    const result = await client.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
    const user = result.data.user;
    const roles = evadUserRoles(user);
    window.EVAD_ROLES = roles;
    window.EVAD_FICHES_FAITES = (user && user.user_metadata && user.user_metadata.fiches_faites) || [];
    currentRole = roles[0];
    closeAuthModal();
    const splash = document.getElementById('evad-splash');
    if (splash) {
      splash.classList.remove('hidden');
      splash.style.opacity = '';
      splash.style.pointerEvents = '';
      splash.style.display = 'flex';
    }
    if (typeof renderRoleSwitcher === 'function') renderRoleSwitcher(roles);
    // Plusieurs profils → sélecteur ; un seul → entrée (tableau de bord si la
    // fiche est déjà faite, sinon onboarding + création).
    if (roles.length > 1) {
      showProfileChooser(roles);
    } else {
      await evadEnterRole(roles[0]);
    }
  } catch (e) {
    onError(e.message || 'Connexion impossible.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btnLabel || 'Se connecter'; }
  }
}

// Formulaire de connexion de la page d'accueil (inline).
async function homeLoginSubmit(){
  const email = (document.getElementById('home-email').value || '').trim();
  const password = document.getElementById('home-password').value || '';
  const errEl = document.getElementById('home-login-error');
  const btn = document.getElementById('home-login-btn');
  if (errEl) errEl.style.display = 'none';
  await evadLoginCore(email, password, function (msg) {
    if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
  }, btn, 'Se connecter');
}

// ── Multi-profil : profils autorisés du compte + sélecteur + switcher ──
const EVAD_ROLE_META = {
  pilote:    { ic:'🏡', name:"Pilote d'impact",    desc:"Coordonner un lieu durable." },
  batisseur: { ic:'🌿', name:"Bâtisseur d'impact", desc:"Passer à l'action, rejoindre des quêtes." },
  semeur:    { ic:'🌾', name:"Semeur d'impact",     desc:"Soutenir et financer des projets." }
};

// Profils autorisés d'un compte : user_metadata.roles (liste), repli sur role.
function evadUserRoles(user){
  const meta = (user && user.user_metadata) || {};
  const valid = ['pilote','batisseur','semeur'];
  let roles = Array.isArray(meta.roles) ? meta.roles.filter(function(r){ return valid.indexOf(r) !== -1; }) : [];
  if (!roles.length) roles = [ valid.indexOf(meta.role) !== -1 ? meta.role : 'batisseur' ];
  return roles;
}

// Sélecteur affiché à la connexion quand le compte a plusieurs profils.
function showProfileChooser(roles){
  const old = document.getElementById('evad-profile-chooser');
  if (old) old.remove();
  const ov = document.createElement('div');
  ov.id = 'evad-profile-chooser';
  ov.style.cssText = "position:fixed;inset:0;z-index:10002;background:rgba(14,26,18,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem;font-family:'Satoshi',sans-serif";
  const cards = roles.map(function(r){
    const m = EVAD_ROLE_META[r] || EVAD_ROLE_META.batisseur;
    return '<button type="button" onclick="chooseProfile(\'' + r + '\')" style="display:flex;align-items:center;gap:.9rem;width:100%;text-align:left;padding:.9rem 1rem;border:1.5px solid rgba(1,130,98,.18);background:#fff;border-radius:14px;cursor:pointer;font-family:inherit">'
      + '<span style="font-size:1.7rem">' + m.ic + '</span>'
      + '<span><span style="display:block;font-weight:700;font-size:.95rem;color:#0d2b22">' + m.name + '</span>'
      + '<span style="display:block;font-size:.75rem;color:#3d6b5a">' + m.desc + '</span></span></button>';
  }).join('');
  ov.innerHTML = '<div style="background:#fff;border-radius:1.5rem;max-width:460px;width:100%;padding:1.7rem 1.6rem">'
    + '<div style="font-weight:800;font-size:1.25rem;color:#0d2b22;margin-bottom:.25rem">Bienvenue 🌱</div>'
    + '<p style="font-size:.83rem;color:#3d6b5a;margin:0 0 1.2rem">Vous avez plusieurs profils. Lequel voulez-vous ouvrir&nbsp;?</p>'
    + '<div style="display:grid;gap:.6rem">' + cards + '</div></div>';
  document.body.appendChild(ov);
}
function chooseProfile(role){
  const ov = document.getElementById('evad-profile-chooser');
  if (ov) ov.remove();
  evadEnterRole(role);
}

// True si la fiche de ce profil a déjà été faite (marqueur sur le compte).
function evadFicheDone(role){
  const done = window.EVAD_FICHES_FAITES;
  return Array.isArray(done) && done.indexOf(role) !== -1;
}

// Entrée dans un profil : tableau de bord si la fiche est déjà faite,
// sinon onboarding + création de fiche.
async function evadEnterRole(role){
  splashRole = role;
  currentRole = role;
  let done = evadFicheDone(role);
  // Rattrapage comptes existants : une fiche Pilote déjà en base = fiche faite.
  if (!done && role === 'pilote') {
    try {
      const client = window.evadSupabase;
      const { data: sess } = await client.auth.getSession();
      const uid = sess && sess.session && sess.session.user && sess.session.user.id;
      if (uid) {
        const { data } = await client.from('fiche_pilote').select('id').eq('user_id', uid).limit(1);
        if (data && data.length) { done = true; evadMarkFicheDone('pilote'); }
      }
    } catch (e) {}
  }
  if (done && typeof evadEnterDashboard === 'function') {
    evadEnterDashboard(role);
  } else if (typeof splashEnter === 'function') {
    splashEnter();
  }
}

// Marque le profil comme « fiche faite » sur le compte (user_metadata),
// pour aller direct au tableau de bord aux prochaines connexions (tous appareils).
async function evadMarkFicheDone(role){
  try {
    const client = window.evadSupabase;
    if (!client) return;
    const { data } = await client.auth.getUser();
    const user = data && data.user;
    if (!user) return;
    const meta = user.user_metadata || {};
    const done = Array.isArray(meta.fiches_faites) ? meta.fiches_faites.slice() : [];
    if (done.indexOf(role) === -1) {
      done.push(role);
      await client.auth.updateUser({ data: Object.assign({}, meta, { fiches_faites: done }) });
      window.EVAD_FICHES_FAITES = done;
    }
  } catch (e) {}
}

// Switcher dans le menu de l'app (visible seulement si plusieurs profils).
function renderRoleSwitcher(roles){
  const c = document.getElementById('role-switch3');
  if (!c) return;
  if (!roles || roles.length < 2) { c.style.display = 'none'; c.innerHTML = ''; return; }
  c.innerHTML = roles.map(function(r){
    const m = EVAD_ROLE_META[r] || EVAD_ROLE_META.batisseur;
    return '<button class="rsw-btn" type="button" data-role="' + r + '" title="' + m.name + '" onclick="switchRole(\'' + r + '\')">'
      + '<span class="rsw-ic">' + m.ic + '</span>'
      + '<span class="rsw-lbl">' + m.name.replace(" d'impact", "") + '</span></button>';
  }).join('');
  c.style.display = 'flex';
  if (typeof updateRoleNavigation === 'function' && currentRole) updateRoleNavigation(currentRole);
}

function openSignupModal(){
  _authMode = 'signup';
  openAuthModal();
  _authMode = 'signup';
  document.getElementById('auth-profil-title').textContent = 'Créer un compte';
  document.getElementById('auth-profil-sub').textContent = 'Choisissez votre rôle EVAD pour commencer.';
}

async function authSubmit(){
  const client = window.evadSupabase;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorBox = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit-btn');
  errorBox.style.display = 'none';
  if (!client) return authShowError('Connexion Supabase indisponible.');
  if (!email || password.length < 6) return authShowError('Saisissez un email et un mot de passe de 6 caractères minimum.');
  btn.disabled = true;
  btn.textContent = 'Patiente…';
  try {
    const result = _authMode === 'signup'
      ? await client.auth.signUp({ email, password, options: { data: { role: _authSelectedRole || 'batisseur' } } })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (_authMode === 'signup' && !result.data.session) {
      authShowError('Compte créé. Vérifiez votre email pour confirmer votre inscription.');
      return;
    }
    const role = result.data.user?.user_metadata?.role || _authSelectedRole || 'batisseur';
    currentRole = role;
    closeAuthModal();
    // Router vers le bon onboarding selon le profil (pilote / batisseur / semeur).
    splashRole = role;
    const splash = document.getElementById('evad-splash');
    if (splash) {
      splash.classList.remove('hidden');
      splash.style.opacity = '';
      splash.style.pointerEvents = '';
      splash.style.display = 'flex';
    }
    if (typeof splashEnter === 'function') {
      splashEnter();
    } else {
      showScreen(({ pilote:'lieu', batisseur:'batisseur', semeur:'semeur' })[role] || 'batisseur');
    }
  } catch (e) {
    authShowError(e.message || 'Connexion impossible.');
  } finally {
    btn.disabled = false;
    btn.textContent = _authMode === 'signup' ? 'Créer mon compte' : 'Se connecter';
  }
}

function authShowError(message){
  const box = document.getElementById('auth-error');
  box.textContent = message;
  box.style.display = 'block';
}

function authToggleMode(){
  _authMode = _authMode === 'login' ? 'signup' : 'login';
  document.querySelector('#auth-connexion-modal h2').textContent = _authMode === 'signup' ? 'Créer un compte' : 'Se connecter';
  document.getElementById('auth-submit-btn').textContent = _authMode === 'signup' ? 'Créer mon compte' : 'Se connecter';
  document.getElementById('auth-mode-btn').textContent = _authMode === 'signup' ? 'Déjà inscrit ? Se connecter' : "Pas encore de compte ? S'inscrire";
  document.getElementById('auth-error').style.display = 'none';
}

function selectAuthProfil(role,ic,name,desc){
  _authSelectedRole = role;
  document.getElementById('auth-profil-modal').style.display='none';
  if (_authMode === 'signup') {
    splashRole = role;
    // L'overlay est dans #evad-splash : le rendre visible (transparent) pour que l'overlay puisse s'afficher
    const splash = document.getElementById('evad-splash');
    splash.classList.remove('hidden');
    splash.style.opacity = '0';
    splash.style.pointerEvents = 'none';
    splash.style.display = 'flex';
    splashEnter();
  } else {
    const badge = document.getElementById('auth-role-badge');
    badge.innerHTML = ic + ' ' + name.toUpperCase();
    // Couleur du badge selon le rôle
    const roleColors = {
      pilote:    { bg: 'rgba(46,107,71,.12)',   color: '#2e6b47' },
      batisseur: { bg: 'rgba(240,176,50,.18)',  color: '#a06c00' },
      semeur:    { bg: 'rgba(59,130,180,.14)',  color: '#2563a8' }
    };
    const c = roleColors[role] || roleColors.pilote;
    badge.style.background = c.bg;
    badge.style.color = c.color;
    document.getElementById('auth-connexion-modal').style.display='flex';
  }
}

function closeAuthModal(){
  document.getElementById('auth-profil-modal').style.display='none';
  document.getElementById('auth-connexion-modal').style.display='none';
}
document.getElementById('auth-profil-modal').addEventListener('click',function(e){if(e.target===this)closeAuthModal();});
document.getElementById('auth-connexion-modal').addEventListener('click',function(e){if(e.target===this)closeAuthModal();});

// Arrivée depuis evad.org (« Se connecter ») : ?login=1 → focus le champ email de l'accueil.
(function(){
  try {
    if (new URLSearchParams(location.search).get('login') === '1') {
      window.addEventListener('load', function(){ setTimeout(function(){
        var el = document.getElementById('home-email');
        if (el) { try { el.focus(); el.scrollIntoView({ behavior:'smooth', block:'center' }); } catch(e){} }
      }, 300); });
    }
  } catch(e){}
})();
