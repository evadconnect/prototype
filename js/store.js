/* EVAD · store.js
   Stockage local + synchronisation de la table lieux avec Supabase.
*/
(function (global) {
  'use strict';

  var NS = 'evad';
  var VERSION = 1;

  // Tables synchronisées avec Supabase (les autres restent locales).
  var remoteTables = ['lieux', 'quetes', 'solutions', 'indicateurs'];
  var currentUserId = null;

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
    'financements',
    'graines_tx',
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
   * Création d'un nouveau lieu dans Supabase.
   *
   * On utilise insert et non upsert afin que la politique
   * RLS publique d'insertion soit suffisante.
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
      .insert(payload)
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

  // ── Synchronisation des quêtes avec Supabase (table quetes) ──
  function remoteQueteRow(row) {
    return {
      id: row.id,
      user_id: currentUserId || null,
      lieu_id: row.lieu_id || null,
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
    // (statut « ouverte »). Les brouillons (a_verifier) et les quêtes retirées
    // restent purement locaux (localStorage) tant que le Pilote n'a pas publié.
    if (row.statut !== 'ouverte') return;
    global.evadSupabase
      .from('quetes')
      .upsert(remoteQueteRow(row), { onConflict: 'id' })
      .then(function (result) {
        if (result.error) {
          console.warn('Quête non enregistrée dans Supabase :', result.error.message);
        }
      });
  }

  // Suppression d'une quête dans Supabase (ex. le Pilote retire une quête
  // auparavant publiée → elle doit disparaître du réseau).
  function deleteQueteRemote(id) {
    if (!global.evadSupabase || !id) return;
    global.evadSupabase
      .from('quetes')
      .delete()
      .eq('id', id)
      .then(function (result) {
        if (result && result.error) {
          console.warn('Quête non supprimée de Supabase :', result.error.message);
        }
      });
  }

  async function hydrateQuetes() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('quetes').select('*');
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
      // Fusion : Supabase fait foi pour les quêtes publiées, mais on conserve
      // les brouillons locaux (non publiés) qui ne sont pas encore en base,
      // sinon l'hydratation les effacerait.
      var remoteIds = {};
      remoteRows.forEach(function (r) { remoteIds[r.id] = true; });
      var localDrafts = read('quetes').filter(function (r) {
        return r && r.statut !== 'ouverte' && !remoteIds[r.id];
      });
      var merged = remoteRows.concat(localDrafts);
      write('quetes', merged);
      global.dispatchEvent(new CustomEvent('evad:quetes-ready', { detail: { quetes: merged } }));
    } catch (error) {
      console.error('Erreur de récupération des quêtes :', error);
    }
  }

  // ── Solutions & indicateurs d'un lieu (tables dédiées) ──
  // Écrites à la publication de la fiche lieu : on remplace l'ensemble des
  // lignes du lieu (suppression puis insertion) pour refléter retraits/ajouts.
  function remoteSolutionRow(r) {
    return {
      id: r.id, user_id: currentUserId || null, lieu_id: r.lieu_id || null,
      nom: r.nom || null, cat: r.cat || null, espace: r.espace || null,
      source_ic: r.source_ic || null, donnees: r, updated_at: nowISO()
    };
  }
  function remoteIndicateurRow(r) {
    return {
      id: r.id, user_id: currentUserId || null, lieu_id: r.lieu_id || null,
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
      write('solutions', read('solutions').filter(function (r) { return r.lieu_id !== lieuId; }).concat(solutions));
      write('indicateurs', read('indicateurs').filter(function (r) { return r.lieu_id !== lieuId; }).concat(indicateurs));
    } catch (e) {}
    _replaceRemoteChildren('solutions', lieuId, solutions.map(remoteSolutionRow));
    _replaceRemoteChildren('indicateurs', lieuId, indicateurs.map(remoteIndicateurRow));
  }

  // ── Catalogue partagé (tables catalogue_solutions / catalogue_indicateurs) ──
  // Source de vérité dans Supabase, éditable via le Table Editor. Si la base est
  // injoignable ou vide, on garde la version embarquée dans le JS (repli sûr).
  // NB : SOLS / ICI_CATALOG / ICI_EXPORTS sont des bindings lexicaux globaux
  // (const de scripts classiques) : on les mute en place, jamais réassignés.
  async function hydrateCatalogue() {
    if (!global.evadSupabase) return;
    try {
      var rs = await global.evadSupabase.from('catalogue_solutions').select('*').order('ordre', { ascending: true });
      if (!rs.error && Array.isArray(rs.data) && rs.data.length && typeof SOLS !== 'undefined') {
        var sols = rs.data.filter(function (r) { return r.actif !== false; }).map(function (r) {
          var o = {
            nom: r.nom, cat: r.cat || 'autre', cplx: r.cplx || 'facile',
            impact: r.impact || '', co2: (r.co2 == null ? 0 : Number(r.co2)),
            tok: (r.graines == null ? 50 : r.graines), img: r.img || '✦',
            desc: r.description || '', avantages: r.avantages || [],
            budget: r.budget || '', ind: r.indicateurs_libres || [],
            esrs: r.esrs || [], esrs_detail: r.esrs_detail || '',
            photo: r.photo || '', lieux: r.lieux || []
          };
          if (r.quete_titre) o.quete = { titre: r.quete_titre, duree: r.quete_duree || '-', nb: r.quete_nb || '-', impact_quete: r.quete_impact || '' };
          return o;
        });
        if (sols.length) { SOLS.length = 0; sols.forEach(function (x) { SOLS.push(x); }); }
      }
      var ri = await global.evadSupabase.from('catalogue_indicateurs').select('*').order('ordre', { ascending: true });
      if (!ri.error && Array.isArray(ri.data) && ri.data.length && typeof ICI_CATALOG !== 'undefined') {
        var icis = ri.data.filter(function (r) { return r.actif !== false; }).map(function (r) {
          return {
            id: r.id, nom: r.nom, livre: r.livre || 'ecologie', unite: r.unite || '',
            point0: (r.point0 == null ? 0 : Number(r.point0)),
            point100: (r.point100 == null ? 100 : Number(r.point100)),
            poids: (r.poids == null ? 1 : Number(r.poids)),
            desc: r.description || '', solutionIds: r.solution_noms || []
          };
        });
        if (icis.length) {
          ICI_CATALOG.length = 0; icis.forEach(function (x) { ICI_CATALOG.push(x); });
          if (typeof ICI_EXPORTS !== 'undefined') {
            ri.data.forEach(function (r) {
              ICI_EXPORTS[r.id] = { odd: r.odd || [], esrs: r.esrs || [], vsme: r.vsme || [] };
            });
          }
        }
      }
      global.dispatchEvent(new CustomEvent('evad:catalogue-ready'));
    } catch (e) {}
  }

  async function hydrateSolutions() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('solutions').select('*');
      if (result.error) return;
      var rows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, lieu_id: row.lieu_id, nom: row.nom, cat: row.cat,
          espace: row.espace, source_ic: row.source_ic
        });
      });
      write('solutions', rows);
      global.dispatchEvent(new CustomEvent('evad:solutions-ready', { detail: { solutions: rows } }));
    } catch (e) {}
  }
  async function hydrateIndicateurs() {
    if (!global.evadSupabase) return;
    try {
      var result = await global.evadSupabase.from('indicateurs').select('*');
      if (result.error) return;
      var rows = (result.data || []).map(function (row) {
        return Object.assign({}, row.donnees || {}, {
          id: row.id, lieu_id: row.lieu_id, ici_id: row.ici_id, nom: row.nom,
          livre: row.livre, unite: row.unite, solutions: row.solutions || []
        });
      });
      write('indicateurs', rows);
      global.dispatchEvent(new CustomEvent('evad:indicateurs-ready', { detail: { indicateurs: rows } }));
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
       * une liste vide (tout supprimé) — sinon les lieux supprimés restent
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
       * Lieux et quêtes sont envoyés dans Supabase.
       */
      if (table === 'lieux') {
        insertLieuRemote(row);
      } else if (table === 'quetes') {
        upsertQueteRemote(row);
      }

      return row;
    },

    update: function (table, id, patch) {
      var rows = read(table);

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
          } else if (table === 'quetes') {
            upsertQueteRemote(rows[i]);
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
  store.hydrateDrafts = hydrateDrafts;
  store.deleteQueteRemote = deleteQueteRemote;
  store.replaceLieuChildren = replaceLieuChildren;

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
        hydrateCatalogue();
        hydrateQuetes();
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
        setTimeout(hydrateCatalogue, 0);
        setTimeout(hydrateQuetes, 0);
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
