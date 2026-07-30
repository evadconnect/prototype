// Ajoute une ligne simple (puce + texte + retrait) à une liste dynamique du formulaire.
function _ctbAddSimple(inputId, listId){
  const inp = document.getElementById(inputId);
  const val = inp.value.trim();
  if(!val) return;
  const list = document.getElementById(listId);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:.5rem;padding:.38rem .6rem;border-radius:.6rem;background:rgba(46,102,66,.05);border:1px solid rgba(46,102,66,.1)';
  row.innerHTML = `<div style="width:5px;height:5px;border-radius:50%;background:var(--fern);flex-shrink:0"></div><span style="flex:1;font-size:.75rem;color:var(--ink)">${val}</span><button onclick="this.parentElement.remove()" style="border:none;background:none;cursor:pointer;color:var(--moss);opacity:.45;font-size:.75rem;padding:0;line-height:1">✕</button>`;
  list.appendChild(row);
  inp.value = '';
  inp.focus();
}
function ctbAddMat(){ _ctbAddSimple('ctb-mat-input', 'ctb-mat-list'); }
function ctbAddAvantage(){ _ctbAddSimple('ctb-avant-input', 'ctb-avant-list'); }
function ctbAddInd(){ _ctbAddSimple('ctb-ind-input', 'ctb-ind-list'); }

/* ── Image de couverture (aperçu local, prête à envoyer avec la proposition) ── */
let ctbPhotoData = '';
let ctbPhotoFile = null;   // fichier brut, uploadé vers le Storage à l'envoi
function ctbPhotoChange(input){
  const file = input.files && input.files[0];
  if(!file || !file.type.startsWith('image/')) return;
  ctbPhotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    ctbPhotoData = e.target.result;
    const zone = document.getElementById('ctb-photo-zone');
    if(zone) zone.style.display = 'none';
    const prev = document.getElementById('ctb-photo-preview');
    if(prev) prev.innerHTML = `<div style="position:relative">
      <img src="${ctbPhotoData}" alt="Image de couverture de la solution" style="width:100%;height:150px;border-radius:.85rem;display:block;object-fit:cover">
      <button type="button" onclick="ctbRemovePhoto()" title="Retirer l'image" style="position:absolute;top:.5rem;right:.5rem;width:26px;height:26px;border-radius:50%;background:rgba(14,26,18,.75);color:white;border:none;cursor:pointer;font-size:.72rem;line-height:1">✕</button>
    </div>`;
  };
  reader.readAsDataURL(file);
}
function ctbRemovePhoto(){
  ctbPhotoData = '';
  ctbPhotoFile = null;
  const input = document.getElementById('ctb-photo-input'); if(input) input.value = '';
  const prev = document.getElementById('ctb-photo-preview'); if(prev) prev.innerHTML = '';
  const zone = document.getElementById('ctb-photo-zone'); if(zone) zone.style.display = '';
}

function ctbAddPlan(){
  const ic    = document.getElementById('ctb-plan-ic').value.trim() || '▶';
  const titre = document.getElementById('ctb-plan-titre').value.trim();
  const desc  = document.getElementById('ctb-plan-desc').value.trim();
  if(!titre) return;
  const list  = document.getElementById('ctb-plan-list');
  const num   = list.children.length + 1;
  const row   = document.createElement('div');
  row.style.cssText = 'display:flex;gap:.65rem;padding:.6rem .7rem;border-radius:.75rem;border:1px solid rgba(46,102,66,.1);background:rgba(46,102,66,.03);align-items:flex-start';
  row.innerHTML = `
    <div style="width:28px;height:28px;border-radius:.5rem;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1rem;background:rgba(46,102,66,.08)">${ic}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:.73rem;font-weight:700;color:var(--ink);margin-bottom:.12rem">${num}. ${titre}</div>
      ${desc?`<div style="font-size:.66rem;color:var(--moss);line-height:1.45;opacity:.85">${desc}</div>`:''}
    </div>
    <button onclick="ctbRemovePlan(this)" style="border:none;background:none;cursor:pointer;color:var(--moss);opacity:.4;font-size:.75rem;padding:0;flex-shrink:0;margin-top:.1rem">✕</button>`;
  list.appendChild(row);
  document.getElementById('ctb-plan-ic').value    = '';
  document.getElementById('ctb-plan-titre').value = '';
  document.getElementById('ctb-plan-desc').value  = '';
  document.getElementById('ctb-plan-titre').focus();
}

function ctbRemovePlan(btn){
  const list = document.getElementById('ctb-plan-list');
  btn.parentElement.remove();
  // Re-numéroter
  Array.from(list.children).forEach((row,i)=>{
    const t = row.querySelector('div > div:first-child');
    if(t) t.textContent = t.textContent.replace(/^\d+\./,(i+1)+'.');
  });
}

// Initialise l'écran « Proposer une solution » : peuple les puces de lieux et
// réinitialise tous les champs. Appelé par showScreen('contribuer').
function initContribuer(){
  // Remet le formulaire visible (masque l'éventuel écran de succès précédent)
  const form = document.getElementById('contrib-form');
  const success = document.getElementById('contrib-success');
  if(form) form.style.display = 'block';
  if(success) success.style.display = 'none';
  // Puces de types de lieux
  const cc = document.getElementById('ctb-lieux-chips');
  if(cc && !cc.children.length && typeof TYPES_LIEU !== 'undefined'){
    TYPES_LIEU.forEach(t=>{
      const btn = document.createElement('button');
      btn.dataset.val = t.id;
      btn.textContent = t.ic + ' ' + t.l;
      btn.style.cssText = 'padding:.3rem .7rem;border-radius:100px;border:1.5px solid rgba(46,102,66,.2);background:transparent;font-size:.7rem;color:var(--moss);cursor:pointer;font-family:inherit;transition:all .15s';
      btn.onclick = function(){
        const active = this.dataset.active==='1';
        this.dataset.active = active?'0':'1';
        this.style.background = active?'transparent':'var(--forest)';
        this.style.color = active?'var(--moss)':'white';
        this.style.borderColor = active?'rgba(46,102,66,.2)':'var(--forest)';
      };
      cc.appendChild(btn);
    });
  } else if(cc){
    // Réinitialise l'état des puces déjà présentes
    cc.querySelectorAll('button').forEach(b=>{
      b.dataset.active='0'; b.style.background='transparent'; b.style.color='var(--moss)'; b.style.borderColor='rgba(46,102,66,.2)';
    });
  }
  // Reset listes dynamiques
  ['ctb-mat-list','ctb-plan-list','ctb-avant-list','ctb-ind-list'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = '';
  });
  // Reset champs texte
  ['ctb-nom','ctb-desc','ctb-impact','ctb-cout-min','ctb-cout-max','ctb-prenom','ctb-email','ctb-source',
   'ctb-quete-nom','ctb-quete-duree','ctb-quete-nb','ctb-quete-impact',
   'ctb-mat-input','ctb-plan-ic','ctb-plan-titre','ctb-plan-desc','ctb-avant-input','ctb-ind-input','ctb-regen','ctb-emoji','ctb-co2'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const catEl = document.getElementById('ctb-cat'); if(catEl) catEl.value = '';
  const cplxEl = document.getElementById('ctb-cplx'); if(cplxEl) cplxEl.value = '';
  if (typeof ctbRemovePhoto === 'function') ctbRemovePhoto();
  const err = document.getElementById('ctb-error'); if(err) err.style.display='none';
}

// Alias historique (la Bibliothèque et d'anciens appels peuvent l'utiliser).
function openContribModal(){ if (typeof showScreen === 'function') showScreen('contribuer'); }
function closeContribModal(){ if (typeof showScreen === 'function') showScreen('bdd'); }

/* ── Envoi des propositions de solution vers Supabase ──────────────────────
   Insertion REST directe dans la table `contributions_solution`, même mécanique
   que le feedback (clé publishable publique + RLS « insert » pour le rôle anon).
   Les données structurées (matériel, plan, avantages, quête…) partent dans une
   colonne JSON `details`. L'image de couverture est uploadée dans le bucket
   Storage `contributions`. Repli localStorage si l'envoi échoue. ── */
const EVAD_CONTRIB_SUPABASE = {
  url: 'https://lmhhrccmgebztioesmik.supabase.co',
  anonKey: 'sb_publishable_M_1-SinRmo1T8exi8_gkvw_RTiHznag',
  table: 'contributions_solution',
  bucket: 'contributions'
};

// Récupère le texte de chaque puce d'une liste dynamique (matériel, avantages…).
function _ctbListValues(listId){
  const el = document.getElementById(listId);
  if(!el) return [];
  return Array.from(el.querySelectorAll('span')).map(s => s.textContent.trim()).filter(Boolean);
}
// Types de lieux sélectionnés (puces actives).
function _ctbSelectedLieux(){
  const cc = document.getElementById('ctb-lieux-chips');
  if(!cc) return [];
  return Array.from(cc.querySelectorAll('button')).filter(b => b.dataset.active === '1').map(b => b.dataset.val);
}
function _ctbVal(id){ const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function _ctbNum(id){ const v = _ctbVal(id); return v === '' ? null : Number(v); }

// Upload de l'image de couverture dans le Storage, renvoie l'URL publique.
async function _ctbUploadPhoto(cfg){
  const base = cfg.url.replace(/\/+$/, '');
  const safe = (ctbPhotoFile.name || 'image').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-50);
  const path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
  const r = await fetch(base + '/storage/v1/object/' + cfg.bucket + '/' + path, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + cfg.anonKey, 'apikey': cfg.anonKey, 'Content-Type': ctbPhotoFile.type || 'image/jpeg' },
    body: ctbPhotoFile
  });
  if(!r.ok) throw new Error('storage HTTP ' + r.status);
  return base + '/storage/v1/object/public/' + cfg.bucket + '/' + path;
}

async function submitContrib(){
  const nom   = _ctbVal('ctb-nom');
  const cat   = document.getElementById('ctb-cat').value;
  const cplx  = document.getElementById('ctb-cplx').value;
  const desc  = _ctbVal('ctb-desc');
  const err   = document.getElementById('ctb-error');
  if(!nom||!cat||!cplx||!desc){
    err.textContent = 'Merci de remplir les champs obligatoires (Nom, Catégorie, Complexité et Description).';
    err.style.display='block';
    err.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }
  err.style.display='none';

  // Ligne principale + données structurées dans `details`.
  const row = {
    emoji:       _ctbVal('ctb-emoji'),
    nom:         nom,
    categorie:   cat,
    complexite:  cplx === '' ? null : Number(cplx),
    description: desc,
    impact:      _ctbVal('ctb-impact'),
    cout_min:    _ctbNum('ctb-cout-min'),
    cout_max:    _ctbNum('ctb-cout-max'),
    prenom:      _ctbVal('ctb-prenom'),
    email:       _ctbVal('ctb-email'),
    source:      _ctbVal('ctb-source'),
    image:       null,
    page:        (location.hash || location.pathname || ''),
    details: {
      lieux:       _ctbSelectedLieux(),
      regen:       _ctbVal('ctb-regen'),
      co2:         _ctbNum('ctb-co2'),
      materiel:    _ctbListValues('ctb-mat-list'),
      avantages:   _ctbListValues('ctb-avant-list'),
      indicateurs: _ctbListValues('ctb-ind-list'),
      plan: Array.from(document.querySelectorAll('#ctb-plan-list > div')).map(r => ({
        titre: (r.querySelector('div > div:first-child') || {}).textContent || '',
        desc:  (r.querySelector('div > div:nth-child(2)')  || {}).textContent || ''
      })),
      quete: {
        nom:    _ctbVal('ctb-quete-nom'),
        duree:  _ctbVal('ctb-quete-duree'),
        nb:     _ctbVal('ctb-quete-nb'),
        impact: _ctbVal('ctb-quete-impact')
      }
    }
  };

  const showSuccess = () => {
    const form = document.getElementById('contrib-form');
    const success = document.getElementById('contrib-success');
    const txt = document.getElementById('contrib-success-txt');
    if(txt) txt.innerHTML = `Ta solution <strong>${nom}</strong> a bien été envoyée. L'équipe EVAD la vérifiera et te contactera si besoin.`;
    if(form) form.style.display = 'none';
    if(success) success.style.display = 'block';
    const main = document.querySelector('.main'); if(main) main.scrollTo(0,0);
  };
  const saveLocal = () => {
    try {
      const all = JSON.parse(localStorage.getItem('evad_contributions') || '[]');
      all.push(row);
      localStorage.setItem('evad_contributions', JSON.stringify(all));
    } catch(e){}
  };

  const cfg = EVAD_CONTRIB_SUPABASE;
  const sendBtn = document.getElementById('ctb-send');
  if(!cfg.url || !cfg.anonKey){ saveLocal(); showSuccess(); return; }

  if(sendBtn){ sendBtn.disabled = true; sendBtn.textContent = 'Envoi en cours…'; }
  try {
    if(ctbPhotoFile){
      try { row.image = await _ctbUploadPhoto(cfg); }
      catch(e){ /* image optionnelle : on continue sans elle */ }
    }
    const r = await fetch(cfg.url.replace(/\/+$/, '') + '/rest/v1/' + cfg.table, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': cfg.anonKey,
        'Authorization': 'Bearer ' + cfg.anonKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    showSuccess();
  } catch(e){
    saveLocal();
    err.textContent = "L'envoi n'a pas fonctionné. Ta proposition est gardée sur cet appareil : réessaie dans un instant.";
    err.style.display = 'block';
    err.scrollIntoView({behavior:'smooth', block:'center'});
  } finally {
    if(sendBtn){ sendBtn.disabled = false; sendBtn.textContent = 'Envoyer ma proposition'; }
  }
}

/* ── Modal détail solution (depuis créer lieu étape 4) ──
   Affiche la MÊME fiche que la Bibliothèque (solFicheHTML), en mode 'modal'. */
function creerOpenSolDetail(nomSol) {
  const s = (typeof SOLS !== 'undefined') ? SOLS.find(x => x.nom === nomSol) : null;
  if (!s) return;
  const modal = document.getElementById('creer-sol-detail-modal');
  if (!modal) return;
  const body = modal.querySelector('#creer-sol-detail-body');
  body.innerHTML = (typeof solFicheHTML === 'function') ? solFicheHTML(s, { context: 'modal' }) : '';
  body.scrollTop = 0;
  modal.style.display = 'flex';
}

function creerCloseSolDetail() {
  document.getElementById('creer-sol-detail-modal').style.display = 'none';
}

/* Bascule entre les onglets Solution / Quête de la fiche solution (création de lieu). */
function creerSolSwitchTab(tab, btn) {
  document.querySelectorAll('.creer-sol-tab').forEach(b => {
    const on = btn ? (b === btn) : (b.getAttribute('onclick') || '').includes("'" + tab + "'");
    b.classList.toggle('active', on);
    b.style.color = on ? 'var(--forest)' : 'var(--moss)';
    b.style.opacity = on ? '1' : '.55';
    b.style.borderBottom = on ? '2px solid var(--forest)' : '2px solid transparent';
  });
  const sol = document.getElementById('creer-sol-tab-solution');
  const que = document.getElementById('creer-sol-tab-quete');
  if (sol) sol.style.display = tab === 'solution' ? 'block' : 'none';
  if (que) que.style.display = tab === 'quete' ? 'block' : 'none';
}
