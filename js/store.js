/* EVAD · store.js
   Stockage local + synchronisation de la table lieux avec Supabase.
*/
(function (global) {
  'use strict';

  var NS = 'evad';
  var VERSION = 1;

  // Pour le moment, seule la table lieux est synchronisée avec Supabase.
  var remoteTables = ['lieux'];
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
      .from('lieux')
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
      .from('lieux')
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

  /*
   * Lecture des lieux publiés.
   */
  async function hydrateRemote() {
    if (!global.evadSupabase) {
      return;
    }

    try {
      var result = await global.evadSupabase
        .from('lieux')
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
       * Ne pas effacer les données locales si Supabase
       * ne retourne encore aucun lieu.
       */
      if (remoteRows.length > 0) {
        write('lieux', remoteRows);
      }

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
       * Seuls les lieux sont envoyés dans Supabase.
       */
      if (table === 'lieux') {
        insertLieuRemote(row);
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

  global.store = store;
  global.EvadStore = store;

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
      }
    );
  } else {
    console.error(
      "Le client Supabase n'est pas disponible."
    );
  }
})(window);
