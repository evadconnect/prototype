let _authSelectedRole = null;
// Bêta sur invitation : plus d'inscription libre, connexion uniquement.
let _authMode = 'login';

// True si une session Supabase est active (compte connecté).
async function evadHasSession(){
  try {
    const c = window.evadSupabase;
    if (!c) return false;
    const { data } = await c.auth.getSession();
    return !!(data && data.session);
  } catch (e) { return false; }
}

// Métadonnées d'affichage par rôle (icône + libellé).
const _authRoleMeta = {
  pilote:    ['🏡', "Pilote d'impact"],
  batisseur: ['🌿', "Bâtisseur d'impact"],
  semeur:    ['🌾', "Semeur d'impact"]
};

// Ouvre directement le formulaire de connexion pré-réglé sur un rôle.
function openLoginForRole(role){
  _authMode = 'login';
  _authSelectedRole = role;
  const meta = _authRoleMeta[role] || _authRoleMeta.pilote;
  selectAuthProfil(role, meta[0], meta[1], '');
}

function openAuthModal(){
  _authMode = 'login';
  document.getElementById('auth-profil-title').textContent = 'Choisir un profil';
  document.getElementById('auth-profil-sub').textContent = 'Sélectionne ton rôle EVAD avant de te connecter.';
  const m=document.getElementById('auth-profil-modal');
  m.style.display='flex';
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
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    const role = result.data.user?.user_metadata?.role || _authSelectedRole || 'batisseur';
    currentRole = role;
    closeAuthModal();
    // Entrée dans l'app via le parcours splash (onboarding puis écran du rôle).
    splashRole = role;
    if (typeof splashEnter === 'function') {
      splashEnter();
    } else {
      showScreen(({ pilote:'lieu', batisseur:'batisseur', semeur:'semeur' })[role] || 'batisseur');
    }
  } catch (e) {
    authShowError(e.message || 'Connexion impossible.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  }
}

function authShowError(message){
  const box = document.getElementById('auth-error');
  box.textContent = message;
  box.style.display = 'block';
}

function selectAuthProfil(role,ic,name,desc){
  _authSelectedRole = role;
  document.getElementById('auth-profil-modal').style.display='none';
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

function closeAuthModal(){
  document.getElementById('auth-profil-modal').style.display='none';
  document.getElementById('auth-connexion-modal').style.display='none';
}
document.getElementById('auth-profil-modal').addEventListener('click',function(e){if(e.target===this)closeAuthModal();});
document.getElementById('auth-connexion-modal').addEventListener('click',function(e){if(e.target===this)closeAuthModal();});
