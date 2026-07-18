let _authSelectedRole = null;
let _authMode = 'login'; // 'login' | 'signup'

function openAuthModal(){
  _authMode = 'login';
  document.getElementById('auth-profil-title').textContent = 'Choisir un profil';
  document.getElementById('auth-profil-sub').textContent = 'Sélectionne ton rôle EVAD avant de te connecter.';
  const m=document.getElementById('auth-profil-modal');
  m.style.display='flex';
}

function openSignupModal(){
  _authMode = 'signup';
  openAuthModal();
  _authMode = 'signup';
  document.getElementById('auth-profil-title').textContent = 'Créer un compte';
  document.getElementById('auth-profil-sub').textContent = 'Choisis ton rôle EVAD pour commencer.';
}

async function authSubmit(){
  const client = window.evadSupabase;
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorBox = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit-btn');
  errorBox.style.display = 'none';
  if (!client) return authShowError('Connexion Supabase indisponible.');
  if (!email || password.length < 6) return authShowError('Saisis un email et un mot de passe de 6 caractères minimum.');
  btn.disabled = true;
  btn.textContent = 'Patiente…';
  try {
    const result = _authMode === 'signup'
      ? await client.auth.signUp({ email, password, options: { data: { role: _authSelectedRole || 'batisseur' } } })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    if (_authMode === 'signup' && !result.data.session) {
      authShowError('Compte créé. Vérifie ton email pour confirmer ton inscription.');
      return;
    }
    const role = result.data.user?.user_metadata?.role || _authSelectedRole || 'batisseur';
    currentRole = role;
    closeAuthModal();
    showScreen(({ pilote:'lieu', batisseur:'batisseur', semeur:'semeur' })[role] || 'batisseur');
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
