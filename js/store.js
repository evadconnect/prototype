/* EVAD · store.js
   Stockage local + synchronisation de la table lieux avec Supabase.
*/
(function (global) {
  'use strict';

  var NS = 'evad';
  var VERSION = 1;

  // Tables synchronisées avec Supabase : lieux (fiche_pilote), quetes
  // (lieu_quetes), quete_candidatures, quete_preuves, lieu_solutions et
  // lieu_indicateurs. Le routage se fait dans insert/update ci-dessous.
  var currentUserId = null;

  // Remonte une erreur de synchronisation à l'utilisateur (au lieu d'un
  // console.warn silencieux) : le Pilote sait que sa donnée n'est pas en base.
  function notifySyncError(message) {
    console.warn(message);
    try {
      if (typeof global.mmBubble === 'function') global.mmBubble('⚠️ ' + message);
    } catch (e) {}
  }

  function keyOf(table) {
    return NS + ':v' + VERSION + ':' + table;
  }

  function draftKey(kind) {
    return NS + ':v' + VERSION + ':draft:' + kind;
  }

  // Les autres collections continuent temporairement à fonctionner localement.
  var TABLES = [
    'lieux',
    'batisseurs',
    'semeurs',
    'quetes',
    'candidatures',
    'quete_candidatures',
    'quete_preuves',
    'financements',
    'graines_tx',
    'mkt_transactions',
    'offres_mkt',
    'reseau_posts'
  ];

  function uuid() {
    if (
      global.crypto &&
      typeof global.crypto.randomUUID === 'function'
    ) {
      return global.crypto.randomUUID();
    }

    return (
      'id-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function read(table) {
    try {
      return (
        JSON.parse(
          global.localStorage.getItem(keyOf(table)) || '[]'
        ) || []
      );
    } catch (e) {
      return [];
    }
  }

  function write(table, rows) {
    try {
      global.localStorage.setItem(
        keyOf(table),
        JSON.stringify(rows)
      );

      return true;
    } catch (e) {
      console.error('Erreur localStorage :', e);
      return false;
    }
  }

  /*
   * Transformation des informations du prototype
   * vers les colonnes de la table Supabase lieux.
   *
   * Toutes les informations complètes sont également
   * conservées dans la colonne donnees au format JSON.
   */
  function remoteLieuRow(row) {
    var latitude =
      row.lat !== undefined && row.lat !== ''
        ? Number(row.lat)
        : null;

    var longitude =
      row.lng !== undefined && row.lng !== ''
        ? Number(row.lng)
        : null;

    // Éviter d'envoyer NaN dans Supabase.
    if (!Number.isFinite(latitude)) {
      latitude = null;
    }

    if (!Number.isFinite(longitude)) {
      longitude = null;
    }

    return {
      id: row.id,
      user_id: currentUserId || null,

      nom:
        row.nom ||
        row.name ||
        'Nouveau lieu',

      type:
        row.type ||
        row.typeLieu ||
        null,

      description:
        row.description ||
        row.desc ||
        row.bio ||
        null,

      localisation:
        row.localisation ||
        row.ville ||
        row.adresse ||
        null,

      latitude: latitude,
      longitude: longitude,

      statut:
        row.statutPublication ||
        row.publicationStatus ||
        'publie',

      // Copie complète du formulaire.
      donnees: row,

      created_at:
        row.created_at ||
        nowISO(),

      updated_at: nowISO()
    };
  }

  /*
   * Création / sauvegarde d'un lieu dans Supabase.
   *
   * upsert avec onConflict:'id' (idempotent, comme fiche_batisseur /
   * fiche_semeur) : republier ou re-sauver le MÊME id met à jour la ligne au
   * lieu d'en créer une seconde. Sans ça, une session dont le cache local est
   * vide (nouvelle connexion) ré-insérait le lieu et créait un doublon.
   */
  function insertLieuRemote(row) {
    if (!global.evadSupabase) {
      console.error(
        "Supabase n'est pas initialisé."
      );
      return;
    }

    var payload = remoteLieuRow(row);

    global.evadSupabase
      .from('fiche_pilote')
      .upsert(payload, { onConflict: 'id' })
      .then(function (result) {
        if (result.error) {
          console.error(
            'Erreur sauvegarde Supabase du lieu :',
            result.error
          );
          return;
        }

        console.log(
          '✅ Lieu sauvegardé dans Supabase :',
          payload.nom
        );

        global.dispatchEvent(
          new CustomEvent('evad:lieu-saved', {
            detail: payload
          })
        );
      })
      .catch(function (error) {
        console.error(
          'Erreur réseau Supabase :',
          error
        );
      });
  }

  /*
   * Mise à jour distante.
   *
   * Une modification distante nécessite une politique RLS
   * supplémentaire. Pour le moment, on conserve la modification
   * localement et on ne bloque pas le prototype.
   */
  function updateLieuRemote(row) {
    if (!global.evadSupabase) {
      return;
    }

    var payload = remoteLieuRow(row);

    global.evadSupabase
      .from('fiche_pilote')
      .update({
        nom: payload.nom,
        type: payload.type,
        description: payload.description,
        localisation: payload.localisation,
        latitude: payload.latitude,
        longitude: payload.longitude,
        statut: payload.statut,
        donnees: payload.donnees,
        updated_at: payload.updated_at
      })
      .eq('id', payload.id)
      .then(function (result) {
        if (result.error) {
          console.warn(
            'Modification enregistrée localement, mais pas encore dans Supabase :',
            result.error.message
          );
          return;
        }

        console.log(
          '✅ Lieu mis à jour dans Supabase'
        );
      });
  }

  // ── Synchronisation des fiches Bâtisseur (table fiche_batisseur) ──
  function remoteBatisseurRow(row) {
    var lat = (row.lat != null && row.lat !== '') ? Number(row.lat) : null;
    var lng = (row.lng != null && row.lng !== '') ? Number(row.lng) : null;
    if (!Number.isFinite(lat)) lat = null;
    if (!Number.isFinite(lng)) lng = null;
    return {
      id: row.id,
      user_id: currentUserId || null,
      prenom: row.prenom || null,
      nom: row.nom || null,
      ville: row.ville || null,
      latitude: lat,
      longitude: lng,
      bio: row.bio || null,
      competences: row.skills || [],
      donnees: row,
      updated_at: nowISO()
    };
  }
  function insertBatisseurRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    // upsert : republier ou rééditer met à jour la même ligne (pas de doublon).
    global.evadSupabase
      .from('fiche_batisseur')
      .upsert(remoteBatisseurRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) notifySyncError('Fiche Bâtisseur non enregistrée en base : ' + result.error.message);
      });
  }
  function updateBatisseurRemote(row) { insertBatisseurRemote(row); }

  // ── Synchronisation des fiches Semeur (table fiche_semeur) ──
  function remoteSemeurRow(row) {
    var lat = (row.lat != null && row.lat !== '') ? Number(row.lat) : null;
    var lng = (row.lng != null && row.lng !== '') ? Number(row.lng) : null;
    if (!Number.isFinite(lat)) lat = null;
    if (!Number.isFinite(lng)) lng = null;
    return {
      id: row.id,
      user_id: currentUserId || null,
      nom: row.nom || null,
      type: row.type || null,
      localisation: row.localisation || null,
      zone: row.zone || null,
      latitude: lat,
      longitude: lng,
      donnees: row,
      updated_at: nowISO()
    };
  }
  function insertSemeurRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    global.evadSupabase
      .from('fiche_semeur')
      .upsert(remoteSemeurRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) notifySyncError('Fiche Semeur non enregistrée en base : ' + result.error.message);
      });
  }
  function updateSemeurRemote(row) { insertSemeurRemote(row); }

  async function hydrateSemeurs() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('fiche_semeur').select('*');
      if (result.error) { console.warn('Lecture des fiches Semeur impossible : ' + result.error.message); return; }
      var remoteRows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, nom: row.nom, type: row.type,
          localisation: row.localisation, zone: row.zone,
          lat: row.latitude, lng: row.longitude
        });
      });
      // La base fait foi : reflet exact du distant (les fiches supprimées
      // dans Supabase disparaissent, ni conservées ni re-poussées).
      write('semeurs', remoteRows);
      global.dispatchEvent(new CustomEvent('evad:semeurs-ready', { detail: { semeurs: remoteRows } }));
    } catch (error) {
      console.warn('Erreur de récupération des fiches Semeur :', error);
    }
  }

  async function hydrateBatisseurs() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('fiche_batisseur').select('*');
      if (result.error) { console.warn('Lecture des fiches Bâtisseur impossible : ' + result.error.message); return; }
      var remoteRows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, prenom: row.prenom, nom: row.nom, ville: row.ville,
          lat: row.latitude, lng: row.longitude, bio: row.bio,
          skills: (row.donnees && row.donnees.skills) || row.competences || []
        });
      });
      // La base fait foi : on reflète EXACTEMENT le distant (une fiche
      // supprimée dans Supabase disparaît, on ne la garde ni ne la re-pousse).
      write('batisseurs', remoteRows);
      global.dispatchEvent(new CustomEvent('evad:batisseurs-ready', { detail: { batisseurs: remoteRows } }));
    } catch (error) {
      console.warn('Erreur de récupération des fiches Bâtisseur :', error);
    }
  }

  // ── Synchronisation des quêtes avec Supabase (table quetes) ──
  function remoteQueteRow(row) {
    // Nom + adresse du lieu, résolus depuis la table lieux locale (miroir Supabase).
    var _lieu = null;
    try { _lieu = (read('lieux') || []).filter(function (l) { return l && l.id === row.lieu_id; })[0] || null; } catch (e) {}
    return {
      id: row.id,
      user_id: currentUserId || null,
      lieu_id: row.lieu_id || null,
      lieu_nom: row.lieu_nom || (_lieu && _lieu.nom) || null,
      adresse: row.adresse || (_lieu && (_lieu.localisation || _lieu.adresse || _lieu.ville)) || null,
      titre: row.titre || '',
      duree: row.duree || null,
      nb: row.nb || null,
      graines: (typeof row.graines === 'number') ? row.graines : (parseInt(row.graines, 10) || 50),
      impact: row.impact || null,
      source: row.source || null,
      source_ic: row.sourceIc || null,
      statut: row.statut || 'a_verifier',
      custom: row.custom === true,
      donnees: row,
      updated_at: nowISO()
    };
  }

  function upsertQueteRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    // On n'inscrit la quête dans Supabase QUE lorsqu'elle est publiée
    // (« ouverte ») ou achevée (« terminee », pour que la validation des
    // preuves survive au rechargement). Les brouillons (a_verifier) et les
    // quêtes retirées restent purement locaux tant que le Pilote n'a pas publié.
    if (row.statut !== 'ouverte' && row.statut !== 'terminee') return;
    global.evadSupabase
      .from('lieu_quetes')
      .upsert(remoteQueteRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) {
          notifySyncError('Quête non enregistrée en base : ' + result.error.message);
        }
      });
  }

  // Suppression d'une quête dans Supabase (ex. le Pilote retire une quête
  // auparavant publiée → elle doit disparaître du réseau).
  function deleteQueteRemote(id) {
    if (!global.evadSupabase || !id) return;
    global.evadSupabase
      .from('lieu_quetes')
      .delete()
      .eq('id', id)
      .then(function (result) {
        if (result && result.error) {
          notifySyncError('Quête non supprimée de la base : ' + result.error.message);
        }
      });
  }

  async function hydrateQuetes() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('lieu_quetes').select('*');
      if (result.error) {
        console.error('Erreur lecture des quêtes :', result.error.message);
        return;
      }
      var remoteRows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, lieu_id: row.lieu_id, titre: row.titre, duree: row.duree,
          nb: row.nb, graines: row.graines, impact: row.impact, source: row.source,
          sourceIc: row.source_ic, statut: row.statut, custom: row.custom === true
        });
      });
      // Fusion : Supabase fait foi pour les quêtes PUBLIÉES (ouverte/terminée) ;
      // on ne conserve en local QUE les brouillons non publiés (a_verifier,
      // en_pause, retiree), qui n'ont jamais vocation à être en base. Une quête
      // publiée absente du distant = supprimée dans Supabase → elle disparaît
      // aussi en local (on ne la garde ni ne la re-pousse).
      var remoteIds = {};
      remoteRows.forEach(function (r) { remoteIds[r.id] = true; });
      var localDrafts = read('quetes').filter(function (r) {
        return r && r.statut !== 'ouverte' && r.statut !== 'terminee' && !remoteIds[r.id];
      });
      var merged = remoteRows.concat(localDrafts);
      write('quetes', merged);
      global.dispatchEvent(new CustomEvent('evad:quetes-ready', { detail: { quetes: merged } }));
    } catch (error) {
      console.error('Erreur de récupération des quêtes :', error);
    }
  }

  // ── Inscriptions des Bâtisseurs + preuves de quête (T0/T1) ──
  // Tables quete_candidatures / quete_preuves : la boucle de retour du
  // parcours quête (rejoindre, prouver, valider) partagée entre appareils.
  function remoteCandidatureRow(row) {
    return {
      id: row.id,
      user_id: currentUserId || null,
      quete_id: row.quete_id || null,
      lieu_id: row.lieu_id || null,
      batisseur_id: row.batisseur_id || null,
      batisseur_nom: row.batisseur_nom || null,
      statut: row.statut || 'inscrit',
      donnees: row,
      updated_at: nowISO()
    };
  }

  function upsertCandidatureRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    global.evadSupabase
      .from('quete_candidatures')
      .upsert(remoteCandidatureRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) {
          notifySyncError('Inscription non enregistrée en base : ' + result.error.message);
        }
      });
  }

  function deleteCandidatureRemote(id) {
    if (!global.evadSupabase || !id) return;
    global.evadSupabase
      .from('quete_candidatures')
      .delete()
      .eq('id', id)
      .then(function (result) {
        if (result && result.error) {
          notifySyncError('Désinscription non enregistrée en base : ' + result.error.message);
        }
      });
  }

  /* ── Financements : engagements des Semeurs sur les quêtes ──
     Partagés entre appareils et profils, sinon le Pilote ne verrait jamais
     qui finance sa quête et le « reste à financer » resterait faux. */
  function remoteFinancementRow(row) {
    return {
      id: row.id,
      user_id: currentUserId || null,
      quete_id: row.quete_id || null,
      lieu_id: row.lieu_id || null,
      semeur_id: row.semeur_id || null,
      semeur_nom: row.semeur_nom || null,
      montant: (typeof row.montant === 'number') ? row.montant : (parseInt(row.montant, 10) || 0),
      statut: row.statut || 'engage',
      donnees: row,
      updated_at: nowISO()
    };
  }

  function upsertFinancementRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    global.evadSupabase
      .from('financements')
      .upsert(remoteFinancementRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) {
          notifySyncError('Financement non enregistré en base : ' + result.error.message);
        }
      });
  }

  function deleteFinancementRemote(id) {
    if (!global.evadSupabase || !id) return;
    global.evadSupabase
      .from('financements')
      .delete()
      .eq('id', id)
      .then(function (result) {
        if (result && result.error) {
          notifySyncError('Financement non retiré de la base : ' + result.error.message);
        }
      });
  }

  async function hydrateFinancements() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('financements').select('*');
      if (result.error) {
        console.warn('Lecture financements impossible : ' + result.error.message);
        return;
      }
      var remoteRows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, quete_id: row.quete_id, lieu_id: row.lieu_id,
          semeur_id: row.semeur_id, semeur_nom: row.semeur_nom,
          montant: row.montant, statut: row.statut,
          created_at: row.created_at, updated_at: row.updated_at
        });
      });
      // ⚠️ Ne pas écraser bêtement le local : les engagements pris AVANT que
      // cette table existe ne vivent que dans le navigateur. Un simple write
      // les effacerait au premier chargement. On pousse donc ceux que le
      // distant ne connaît pas, puis on garde l'union.
      var connus = {};
      remoteRows.forEach(function (r) { connus[r.id] = true; });
      var orphelins = read('financements').filter(function (r) { return r && r.id && !connus[r.id]; });
      orphelins.forEach(function (r) { try { upsertFinancementRemote(r); } catch (e) {} });
      var fusion = remoteRows.concat(orphelins);
      write('financements', fusion);
      global.dispatchEvent(new CustomEvent('evad:financements-ready', { detail: { rows: fusion } }));
    } catch (error) {
      console.warn('Erreur de récupération financements :', error);
    }
  }

  function remotePreuveRow(row) {
    return {
      id: row.id,
      user_id: currentUserId || null,
      quete_id: row.quete_id || null,
      lieu_id: row.lieu_id || null,
      batisseur_id: row.batisseur_id || null,
      batisseur_nom: row.batisseur_nom || null,
      phase: row.phase || 't1',
      type: row.type || 'photo',
      note: row.note || null,
      valeur: row.valeur || null,
      photo_url: row.photo_url || null,
      validee: row.validee === true,
      donnees: row,
      updated_at: nowISO()
    };
  }

  function upsertPreuveRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    global.evadSupabase
      .from('quete_preuves')
      .upsert(remotePreuveRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) {
          notifySyncError('Preuve non enregistrée en base : ' + result.error.message);
        }
      });
  }

  // Hydratation générique : la base fait foi. Reflet EXACT du distant (une
  // ligne supprimée dans Supabase disparaît en local, elle n'est ni conservée
  // ni re-poussée). pushFn est conservé pour compat mais n'est plus appelé ici.
  async function _hydrateQueteChildren(table, pushFn, eventName) {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from(table).select('*');
      if (result.error) {
        console.warn('Lecture ' + table + ' impossible : ' + result.error.message);
        return;
      }
      var remoteRows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, quete_id: row.quete_id, lieu_id: row.lieu_id,
          batisseur_id: row.batisseur_id, batisseur_nom: row.batisseur_nom,
          statut: row.statut, phase: row.phase, type: row.type,
          note: row.note, valeur: row.valeur, photo_url: row.photo_url,
          validee: row.validee === true,
          created_at: row.created_at, updated_at: row.updated_at
        });
      });
      write(table, remoteRows);
      global.dispatchEvent(new CustomEvent(eventName, { detail: { rows: remoteRows } }));
    } catch (error) {
      console.warn('Erreur de récupération ' + table + ' :', error);
    }
  }

  function hydrateCandidatures() {
    return _hydrateQueteChildren('quete_candidatures', upsertCandidatureRemote, 'evad:candidatures-ready');
  }
  function hydratePreuves() {
    return _hydrateQueteChildren('quete_preuves', upsertPreuveRemote, 'evad:preuves-ready');
  }

  // ── Grand livre des graines (monnaie EVAD) : table graines_tx ──
  // Chaque ligne est un mouvement signé (delta) rattaché à un « profil »
  // (party_type = pilote|batisseur|semeur, party_id = id du lieu / bâtisseur /
  // semeur). Le solde d'un profil = somme des delta. Partagé entre appareils et
  // profils : le Pilote hôte voit son crédit, le Bâtisseur son débit.
  function remoteGrainesTxRow(row) {
    return {
      id: row.id,
      user_id: currentUserId || null,
      party_type: row.party_type || null,
      party_id: row.party_id || null,
      delta: (typeof row.delta === 'number') ? row.delta : 0,
      type: row.type || null,
      label: row.label || null,
      ref_table: row.ref_table || null,
      ref_id: row.ref_id != null ? String(row.ref_id) : null,
      donnees: row,
      created_at: row.created_at || nowISO()
    };
  }
  function upsertGrainesTxRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    global.evadSupabase
      .from('graines_tx')
      .upsert(remoteGrainesTxRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) notifySyncError('Mouvement de graines non enregistré : ' + result.error.message);
      });
  }
  async function hydrateGraines() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('graines_tx').select('*');
      if (result.error) { console.warn('Lecture graines_tx impossible : ' + result.error.message); return; }
      var rows = (result.data || []).map(function (r) {
        return Object.assign({}, r.donnees || {}, {
          id: r.id, party_type: r.party_type, party_id: r.party_id,
          delta: r.delta, type: r.type, label: r.label,
          ref_table: r.ref_table, ref_id: r.ref_id, created_at: r.created_at
        });
      });
      write('graines_tx', rows);
      global.dispatchEvent(new CustomEvent('evad:graines-ready', { detail: { rows: rows } }));
    } catch (e) { console.warn('Erreur récupération graines_tx :', e); }
  }

  // ── Accès de la Récolte : table recolte_acces (ex offres_mkt, partagée) ──
  // Le nom LOCAL du store reste 'offres_mkt' (clé interne, pour ne pas toucher
  // tout app-core) ; seule la table DISTANTE et ses colonnes sont renommées :
  // prix→graines_cost, stock→places, stockMax→places_max, + hors_exploitation.
  function remoteOffreRow(row) {
    return {
      id: row.id,
      user_id: currentUserId || null,
      lieu_id: row.lieu_id || null,
      lieu_nom: row.lieu_nom || null,
      titre: row.titre || null,
      cat: row.cat || null,
      graines_cost: (typeof row.prix === 'number') ? row.prix : (parseInt(row.prix, 10) || 0),
      places: (typeof row.stock === 'number') ? row.stock : (parseInt(row.stock, 10) || 0),
      places_max: (typeof row.stockMax === 'number') ? row.stockMax : (parseInt(row.stockMax, 10) || 0),
      hors_exploitation: !!row.hors_exploitation,
      emoji: row.emoji || null,
      description: row.desc || row.description || null,
      statut: row.status || row.statut || 'active',
      vues: (typeof row.vues === 'number') ? row.vues : 0,
      echanges: (typeof row.echanges === 'number') ? row.echanges : 0,
      donnees: row,
      updated_at: nowISO()
    };
  }
  function upsertOffreRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    global.evadSupabase
      .from('recolte_acces')
      .upsert(remoteOffreRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) notifySyncError('Accès non enregistré : ' + result.error.message);
      });
  }
  function deleteOffreRemote(id) {
    if (!global.evadSupabase || !id) return;
    global.evadSupabase.from('recolte_acces').delete().eq('id', id).then(function (r) {
      if (r && r.error) notifySyncError('Suppression d\'accès non enregistrée : ' + r.error.message);
    });
  }
  async function hydrateOffres() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('recolte_acces').select('*');
      if (result.error) { console.warn('Lecture recolte_acces impossible : ' + result.error.message); return; }
      var rows = (result.data || []).map(function (r) {
        return Object.assign({}, r.donnees || {}, {
          id: r.id, lieu_id: r.lieu_id, lieu_nom: r.lieu_nom,
          titre: r.titre, cat: r.cat, prix: r.graines_cost, stock: r.places, stockMax: r.places_max,
          hors_exploitation: !!r.hors_exploitation,
          emoji: r.emoji, desc: r.description, status: r.statut,
          vues: r.vues, echanges: r.echanges, created_at: r.created_at, updated_at: r.updated_at
        });
      });
      write('offres_mkt', rows);
      global.dispatchEvent(new CustomEvent('evad:offres-ready', { detail: { rows: rows } }));
    } catch (e) { console.warn('Erreur récupération recolte_acces :', e); }
  }

  // ── Transactions Marketplace (escrow / double validation) : mkt_transactions ──
  // Un déverrouillage crée une transaction « en_attente » (graines du Bâtisseur
  // bloquées). Le Pilote hôte confirme la remise de l'accès → « confirmee »
  // (transfert des graines via graines_tx). Annulable tant que non confirmée.
  function remoteMktTxRow(row) {
    return {
      id: row.id,
      user_id: currentUserId || null,
      offer_id: row.offer_id != null ? String(row.offer_id) : null,
      offer_titre: row.offer_titre || null,
      prix: (typeof row.prix === 'number') ? row.prix : 0,
      buyer_type: row.buyer_type || null,
      buyer_id: row.buyer_id || null,
      buyer_nom: row.buyer_nom || null,
      seller_type: row.seller_type || null,
      seller_id: row.seller_id || null,
      seller_nom: row.seller_nom || null,
      code: row.code || null,
      statut: row.statut || 'en_attente',
      donnees: row,
      created_at: row.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function upsertMktTxRemote(row) {
    if (!global.evadSupabase || !row || !row.id) return;
    global.evadSupabase
      .from('mkt_transactions')
      .upsert(remoteMktTxRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) notifySyncError('Transaction non enregistrée : ' + result.error.message);
      });
  }
  async function hydrateMktTx() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('mkt_transactions').select('*');
      if (result.error) { console.warn('Lecture mkt_transactions impossible : ' + result.error.message); return; }
      var rows = (result.data || []).map(function (r) {
        return Object.assign({}, r.donnees || {}, {
          id: r.id, offer_id: r.offer_id, offer_titre: r.offer_titre, prix: r.prix,
          buyer_type: r.buyer_type, buyer_id: r.buyer_id, buyer_nom: r.buyer_nom,
          seller_type: r.seller_type, seller_id: r.seller_id, seller_nom: r.seller_nom,
          code: r.code, statut: r.statut, created_at: r.created_at, updated_at: r.updated_at
        });
      });
      write('mkt_transactions', rows);
      global.dispatchEvent(new CustomEvent('evad:mkttx-ready', { detail: { rows: rows } }));
    } catch (e) { console.warn('Erreur récupération mkt_transactions :', e); }
  }

  // ── Solutions & indicateurs d'un lieu (tables dédiées) ──
  // Écrites à la publication de la fiche lieu : on remplace l'ensemble des
  // lignes du lieu (suppression puis insertion) pour refléter retraits/ajouts.
  function remoteSolutionRow(r) {
    return {
      id: r.id, user_id: currentUserId || null, lieu_id: r.lieu_id || null,
      lieu_nom: r.lieu_nom || null, adresse: r.adresse || null,
      nom: r.nom || null, cat: r.cat || null, espace: r.espace || null,
      source_ic: r.source_ic || null, donnees: r, updated_at: nowISO()
    };
  }
  function remoteIndicateurRow(r) {
    return {
      id: r.id, user_id: currentUserId || null, lieu_id: r.lieu_id || null,
      lieu_nom: r.lieu_nom || null, adresse: r.adresse || null,
      ici_id: r.ici_id || null, nom: r.nom || null, livre: r.livre || null,
      unite: r.unite || null, solutions: r.solutions || [], donnees: r, updated_at: nowISO()
    };
  }
  function _replaceRemoteChildren(table, lieuId, rows) {
    if (!global.evadSupabase) return;
    global.evadSupabase.from(table).delete().eq('lieu_id', lieuId).then(function (res) {
      if (res && res.error) { console.warn(table + ' : suppression échouée : ' + res.error.message); return; }
      if (!rows.length) return;
      global.evadSupabase.from(table).upsert(rows, { onConflict: 'id' }).then(function (r2) {
        if (r2 && r2.error) console.warn(table + ' non enregistrées dans Supabase : ' + r2.error.message);
      });
    });
  }
  // Remplace les solutions + indicateurs d'un lieu (miroir local + Supabase).
  function replaceLieuChildren(lieuId, solutions, indicateurs) {
    if (!lieuId) return;
    solutions = solutions || []; indicateurs = indicateurs || [];
    try {
      write('lieu_solutions', read('lieu_solutions').filter(function (r) { return r.lieu_id !== lieuId; }).concat(solutions));
      write('lieu_indicateurs', read('lieu_indicateurs').filter(function (r) { return r.lieu_id !== lieuId; }).concat(indicateurs));
    } catch (e) {}
    _replaceRemoteChildren('lieu_solutions', lieuId, solutions.map(remoteSolutionRow));
    _replaceRemoteChildren('lieu_indicateurs', lieuId, indicateurs.map(remoteIndicateurRow));
  }

  // ── Bibliothèque partagée (tables biblio_solutions / biblio_indicateurs) ──
  // Source de vérité dans Supabase, éditable via le Table Editor. Si la base est
  // injoignable ou vide, on garde la version embarquée dans le JS (repli sûr).
  // NB : SOLS / ICI_CATALOG / ICI_EXPORTS sont des bindings lexicaux globaux
  // (const de scripts classiques) : on les mute en place, jamais réassignés.
  async function hydrateBiblio() {
    if (!global.evadSupabase) return;
    try {
      var rs = await global.evadSupabase.from('biblio_solutions').select('*').order('ordre', { ascending: true });
      if (!rs.error && Array.isArray(rs.data) && rs.data.length && typeof SOLS !== 'undefined') {
        var sols = rs.data.filter(function (r) { return r.actif !== false; }).map(function (r) {
          var o = {
            nom: r.nom, cat: r.cat || 'autre', cplx: r.cplx || 'facile',
            impact: r.impact || '', co2: (r.co2 == null ? 0 : Number(r.co2)),
            tok: (r.graines == null ? 50 : r.graines), img: r.img || '✦',
            desc: r.description || '', avantages: r.avantages || [],
            budget: r.budget || '', ind: r.indicateurs_libres || [],
            esrs: r.esrs || [], esrs_detail: r.esrs_detail || '',
            photo: r.photo || '', lieux: r.lieux || [],
            // Coûts structurés (estimation par espace) : fixe + unitaire × dimension.
            coutFixe: (r.cout_fixe == null ? null : Number(r.cout_fixe)),
            coutUnitaire: (r.cout_unitaire == null ? null : Number(r.cout_unitaire)),
            coutDimension: r.cout_dimension || null
          };
          if (r.quete_titre) o.quete = { titre: r.quete_titre, duree: r.quete_duree || '-', nb: r.quete_nb || '-', impact_quete: r.quete_impact || '' };
          return o;
        });
        if (sols.length) {
          SOLS.length = 0; sols.forEach(function (x) { SOLS.push(x); });
          // Coûts par défaut (embarqués dans app-core.js) pour les lignes
          // cloud sans colonnes cout_fixe/cout_unitaire remplies.
          if (typeof SOLS_COUTS_DEFAUT !== 'undefined') {
            SOLS.forEach(function (s) {
              var c = SOLS_COUTS_DEFAUT[s.nom];
              if (c && s.coutUnitaire == null) { s.coutFixe = c.fixe; s.coutUnitaire = c.unitaire; s.coutDimension = c.dim; }
            });
          }
        }
      }
      var ri = await global.evadSupabase.from('biblio_indicateurs').select('*').order('ordre', { ascending: true });
      if (!ri.error && Array.isArray(ri.data) && ri.data.length && typeof ICI_CATALOG !== 'undefined') {
        var icis = ri.data.filter(function (r) { return r.actif !== false; }).map(function (r) {
          return {
            id: r.id, nom: r.nom, livre: r.livre || 'ecologie', unite: r.unite || '',
            point0: (r.point0 == null ? 0 : Number(r.point0)),
            point100: (r.point100 == null ? 100 : Number(r.point100)),
            poids: (r.poids == null ? 1 : Number(r.poids)),
            desc: r.description || '', photo: r.photo || '',
            solutionIds: r.solution_noms || [],
            // Normalisation par lieu : point100 effectif = base × dimension × coef.
            norme: r.norme || null,
            baseUnitaire: (r.base_unitaire == null ? null : Number(r.base_unitaire)),
            coefTypes: r.coef_types || null
          };
        });
        if (icis.length) {
          ICI_CATALOG.length = 0; icis.forEach(function (x) { ICI_CATALOG.push(x); });
          // Normes par défaut (embarquées dans ici.js) pour les lignes cloud
          // qui n'ont pas encore leurs colonnes norme/base_unitaire remplies.
          if (typeof ICI_NORMES_DEFAUT !== 'undefined') {
            ICI_CATALOG.forEach(function (i) {
              var n = ICI_NORMES_DEFAUT[i.id];
              if (n && i.norme == null) { i.norme = n.norme; i.baseUnitaire = n.base; i.coefTypes = n.coefs; }
            });
          }
          if (typeof ICI_EXPORTS !== 'undefined') {
            ri.data.forEach(function (r) {
              ICI_EXPORTS[r.id] = { odd: r.odd || [], esrs: r.esrs || [], vsme: r.vsme || [] };
            });
          }
        }
      }
      // Barème économique des espaces (table facultative : silencieux si absente).
      try {
        var re = await global.evadSupabase.from('biblio_espaces_eco').select('*');
        if (!re.error && Array.isArray(re.data) && re.data.length && typeof ESPACES_ECO !== 'undefined') {
          re.data.forEach(function (r) {
            ESPACES_ECO[r.id] = {
              dim: r.dim || 'capacite',
              facteur: (r.facteur == null ? 1 : Number(r.facteur)),
              unite: r.unite || '',
              prixMin: (r.prix_min == null ? 0 : Number(r.prix_min)),
              prixMax: (r.prix_max == null ? 0 : Number(r.prix_max)),
              prixUnite: r.prix_unite || '€',
              charges: (r.charges_pct == null ? 0.4 : Number(r.charges_pct)),
              actif: r.actif !== false
            };
          });
        }
      } catch (e2) {}
      global.dispatchEvent(new CustomEvent('evad:biblio-ready'));
    } catch (e) {}
  }

  async function hydrateSolutions() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('lieu_solutions').select('*');
      if (result.error) return;
      var rows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, lieu_id: row.lieu_id, nom: row.nom, cat: row.cat,
          espace: row.espace, source_ic: row.source_ic
        });
      });
      write('lieu_solutions', rows);
      global.dispatchEvent(new CustomEvent('evad:lieu-solutions-ready', { detail: { solutions: rows } }));
    } catch (e) {}
  }
  async function hydrateIndicateurs() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('lieu_indicateurs').select('*');
      if (result.error) return;
      var rows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, lieu_id: row.lieu_id, ici_id: row.ici_id, nom: row.nom,
          livre: row.livre, unite: row.unite, solutions: row.solutions || []
        });
      });
      write('lieu_indicateurs', rows);
      global.dispatchEvent(new CustomEvent('evad:lieu-indicateurs-ready', { detail: { indicateurs: rows } }));
    } catch (e) {}
  }

  /*
   * Lecture des lieux publiés.
   */
  async function hydrateRemote() {
    if (!global.evadSupabase) {
      return;
    }

    try {
      var result = await global.evadSupabase
        .from('fiche_pilote')
        .select('*')
        .order('created_at', {
          ascending: true
        });

      if (result.error) {
        console.error(
          'Erreur lecture des lieux :',
          result.error.message
        );
        return;
      }

      var remoteRows = (result.data || []).map(
        function (row) {
          return Object.assign(
            {},
            row.donnees || {},
            row,
            {
              id: row.id,
              lat: row.latitude,
              lng: row.longitude
            }
          );
        }
      );

      /*
       * La requête a réussi : on reflète l'état EXACT de Supabase, y compris
       * une liste vide (tout supprimé), sinon les lieux supprimés restent
       * affichés depuis le cache local.
       */
      write('lieux', remoteRows);

      global.dispatchEvent(
        new CustomEvent(
          'evad:supabase-ready',
          {
            detail: {
              lieux: remoteRows
            }
          }
        )
      );
    } catch (error) {
      console.error(
        'Erreur de récupération Supabase :',
        error
      );
    }
  }

  var store = {
    uuid: uuid,
    now: nowISO,
    TABLES: TABLES,

    all: function (table) {
      return read(table);
    },

    get: function (table, id) {
      var rows = read(table);

      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id === id) {
          return rows[i];
        }
      }

      return null;
    },

    where: function (table, predicate) {
      return read(table).filter(predicate);
    },

    insert: function (table, object) {
      var rows = read(table);
      var row = Object.assign({}, object);

      if (!row.id) {
        row.id = uuid();
      }

      if (!row.created_at) {
        row.created_at = nowISO();
      }

      row.updated_at = nowISO();

      rows.push(row);
      write(table, rows);

      /*
       * Lieux, quêtes, inscriptions et preuves sont envoyés dans Supabase.
       */
      if (table === 'lieux') {
        insertLieuRemote(row);
      } else if (table === 'batisseurs') {
        insertBatisseurRemote(row);
      } else if (table === 'semeurs') {
        insertSemeurRemote(row);
      } else if (table === 'quetes') {
        upsertQueteRemote(row);
      } else if (table === 'quete_candidatures') {
        upsertCandidatureRemote(row);
      } else if (table === 'quete_preuves') {
        upsertPreuveRemote(row);
      } else if (table === 'financements') {
        upsertFinancementRemote(row);
      } else if (table === 'graines_tx') {
        upsertGrainesTxRemote(row);
      } else if (table === 'mkt_transactions') {
        upsertMktTxRemote(row);
      } else if (table === 'offres_mkt') {
        upsertOffreRemote(row);
      }

      return row;
    },

    update: function (table, id, patch) {
      var rows = read(table);

      // Garde-fou anti-écrasement des espaces d'un lieu : une écriture ne peut
      // pas RÉDUIRE espacesData (ni le vider) sauf si elle est explicitement
      // marquée _espacesEdit (édition/suppression volontaire d'un espace). Cela
      // empêche une sauvegarde d'identité/contact/solutions faite depuis un état
      // périmé de tronquer silencieusement la liste des espaces.
      if (table === 'lieux' && patch) {
        var _allowEspacesShrink = patch._espacesEdit === true;
        if (patch._espacesEdit !== undefined) { patch = Object.assign({}, patch); delete patch._espacesEdit; }
        var _cur = store.get('lieux', id);
        if (!_allowEspacesShrink && _cur && Array.isArray(_cur.espacesData) && Array.isArray(patch.espacesData)
            && patch.espacesData.length < _cur.espacesData.length) {
          patch = Object.assign({}, patch);
          delete patch.espacesData; delete patch.espaces; delete patch.solsByEspace;
          if (global.console) console.warn('[store] écrasement d\'espacesData bloqué (lieu ' + id + ' : ' + _cur.espacesData.length + ' → ' + '…). Utilise _espacesEdit pour une édition volontaire.');
        }
      }

      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id === id) {
          rows[i] = Object.assign(
            {},
            rows[i],
            patch,
            {
              id: id,
              updated_at: nowISO()
            }
          );

          write(table, rows);

          if (table === 'lieux') {
            updateLieuRemote(rows[i]);
          } else if (table === 'batisseurs') {
            updateBatisseurRemote(rows[i]);
          } else if (table === 'semeurs') {
            updateSemeurRemote(rows[i]);
          } else if (table === 'quetes') {
            upsertQueteRemote(rows[i]);
          } else if (table === 'quete_candidatures') {
            upsertCandidatureRemote(rows[i]);
          } else if (table === 'quete_preuves') {
            upsertPreuveRemote(rows[i]);
          } else if (table === 'financements') {
            upsertFinancementRemote(rows[i]);
          } else if (table === 'graines_tx') {
            upsertGrainesTxRemote(rows[i]);
          } else if (table === 'mkt_transactions') {
            upsertMktTxRemote(rows[i]);
          } else if (table === 'offres_mkt') {
            upsertOffreRemote(rows[i]);
          }

          return rows[i];
        }
      }

      return null;
    },

    upsert: function (table, object) {
      if (
        object &&
        object.id &&
        store.get(table, object.id)
      ) {
        return store.update(
          table,
          object.id,
          object
        );
      }

      return store.insert(
        table,
        object
      );
    },

    remove: function (table, id) {
      var rows = read(table).filter(
        function (row) {
          return row.id !== id;
        }
      );

      write(table, rows);

      // Propagation de la suppression en base pour les tables concernées.
      if (table === 'offres_mkt') {
        deleteOffreRemote(id);
      }
    },

    clearTable: function (table) {
      write(table, []);
    },

    saveDraft: function (kind, data) {
      try {
        global.localStorage.setItem(
          draftKey(kind),
          JSON.stringify({
            data: data,
            updated_at: nowISO()
          })
        );

        saveDraftRemote(kind, data);
        return true;
      } catch (e) {
        return false;
      }
    },

    loadDraft: function (kind) {
      try {
        var raw = JSON.parse(
          global.localStorage.getItem(
            draftKey(kind)
          ) || 'null'
        );

        return raw
          ? raw.data
          : null;
      } catch (e) {
        return null;
      }
    },

    clearDraft: function (kind) {
      try {
        global.localStorage.removeItem(
          draftKey(kind)
        );
      } catch (e) {}
      clearDraftRemote(kind);
    },

    refreshLieux: function () {
      return hydrateRemote();
    },

    _dump: function () {
      var output = {};

      TABLES.forEach(function (table) {
        output[table] = read(table);
      });

      return output;
    },

    _reset: function () {
      TABLES.forEach(function (table) {
        write(table, []);
      });

      [
        'lieu',
        'batisseur',
        'semeur'
      ].forEach(function (kind) {
        store.clearDraft(kind);
      });
    }
  };

  // ── Brouillons synchronisés dans le cloud (table fiches_brouillons) ──
  // Rattachés au compte connecté → on reprend sa fiche depuis n'importe quel
  // appareil. Sans connexion, on retombe sur le brouillon localStorage seul.
  var _draftTimers = {};
  function saveDraftRemote(kind, data) {
    if (!currentUserId || !global.evadSupabase) return;
    clearTimeout(_draftTimers[kind]);
    _draftTimers[kind] = setTimeout(function () {
      global.evadSupabase
        .from('fiches_brouillons')
        .upsert(
          { user_id: currentUserId, kind: kind, data: data, updated_at: nowISO() },
          { onConflict: 'user_id,kind' }
        )
        .then(function (r) {
          if (r.error) console.warn('Brouillon cloud non sauvegardé :', r.error.message);
        });
    }, 1500);
  }

  function clearDraftRemote(kind) {
    if (!currentUserId || !global.evadSupabase) return;
    global.evadSupabase
      .from('fiches_brouillons')
      .delete()
      .eq('user_id', currentUserId)
      .eq('kind', kind)
      .then(function () {});
  }

  // Récupère les brouillons du compte et les injecte dans le localStorage
  // (le cloud gagne s'il est plus récent) → l'UI existante les retrouve.
  function hydrateDrafts() {
    if (!currentUserId || !global.evadSupabase) return Promise.resolve();
    return global.evadSupabase
      .from('fiches_brouillons')
      .select('kind,data,updated_at')
      .eq('user_id', currentUserId)
      .then(function (r) {
        if (r.error || !Array.isArray(r.data)) return;
        r.data.forEach(function (row) {
          try {
            var localRaw = JSON.parse(global.localStorage.getItem(draftKey(row.kind)) || 'null');
            if (!localRaw || !localRaw.updated_at || (row.updated_at && row.updated_at >= localRaw.updated_at)) {
              global.localStorage.setItem(
                draftKey(row.kind),
                JSON.stringify({ data: row.data, updated_at: row.updated_at || nowISO() })
              );
            }
          } catch (e) {}
        });
      })
      .catch(function () {});
  }

  global.store = store;
  global.EvadStore = store;
  // Id du compte connecté (Supabase auth) : permet à l'app de retrouver LE lieu
  // de l'utilisateur (par user_id) plutôt que le dernier lieu de la communauté,
  // et donc de mettre à jour sa fiche au lieu d'en créer une nouvelle.
  store.userId = function () { return currentUserId; };
  store.hydrateDrafts = hydrateDrafts;
  store.deleteQueteRemote = deleteQueteRemote;
  store.upsertQueteRemote = upsertQueteRemote;
  store.deleteCandidatureRemote = deleteCandidatureRemote;
  store.deleteFinancementRemote = deleteFinancementRemote;
  store.hydrateFinancements = hydrateFinancements;
  store.replaceLieuChildren = replaceLieuChildren;
  store.hydrateGraines = hydrateGraines;
  store.hydrateMktTx = hydrateMktTx;
  store.hydrateOffres = hydrateOffres;

  /*
   * Récupération de la session Supabase si elle existe.
   */
  if (global.evadSupabase) {
    global.evadSupabase.auth
      .getSession()
      .then(function (result) {
        currentUserId =
          result.data &&
          result.data.session &&
          result.data.session.user
            ? result.data.session.user.id
            : null;

        hydrateRemote();
        hydrateBiblio();
        hydrateBatisseurs();
        hydrateSemeurs();
        hydrateQuetes();
        hydrateCandidatures();
        hydratePreuves();
        hydrateFinancements();
        hydrateGraines();
        hydrateMktTx();
        hydrateOffres();
        hydrateSolutions();
        hydrateIndicateurs();
        hydrateDrafts().then(function () {
          if (typeof global.splashInitResume === 'function') global.splashInitResume();
        });
      });

    global.evadSupabase.auth.onAuthStateChange(
      function (_event, session) {
        currentUserId =
          session && session.user
            ? session.user.id
            : null;

        setTimeout(
          hydrateRemote,
          0
        );
        setTimeout(hydrateBiblio, 0);
        setTimeout(hydrateBatisseurs, 0);
        setTimeout(hydrateSemeurs, 0);
        setTimeout(hydrateQuetes, 0);
        setTimeout(hydrateCandidatures, 0);
        setTimeout(hydratePreuves, 0);
        setTimeout(hydrateFinancements, 0);
        setTimeout(hydrateGraines, 0);
        setTimeout(hydrateMktTx, 0);
        setTimeout(hydrateOffres, 0);
        setTimeout(hydrateSolutions, 0);
        setTimeout(hydrateIndicateurs, 0);
        hydrateDrafts().then(function () {
          if (typeof global.splashInitResume === 'function') global.splashInitResume();
        });
      }
    );
  } else {
    console.error(
      "Le client Supabase n'est pas disponible."
    );
  }
})(window);
