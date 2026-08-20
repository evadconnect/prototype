# Déploiement « la Récolte » — mode d'emploi

Tout est préparé. Voici les 4 actions, **dans l'ordre**, à faire sur la base **dev**
d'abord. Chaque étape est réversible et ne supprime aucune donnée.

> Rien de tout ceci n'est encore actif : les fichiers sont inertes tant que tu ne
> les exécutes/déploies pas. Le module fonctionne toujours avec l'ancien schéma
> en attendant.

---

## Étape 1 — Migration de la base (≈ 2 min)

1. Supabase → projet **dev** → **SQL Editor**
2. Colle et exécute **`supabase-recolte-migration.sql`**
3. La requête de vérification (en bas du fichier) doit montrer les colonnes
   `graines_cost`, `places`, `places_max`, `hors_exploitation`.

Renomme : `offres_mkt → recolte_acces`, `prix → graines_cost`, `stock → places`,
`stock_max → places_max`, et ajoute `hors_exploitation`.

## Étape 2 — La logique de déverrouillage en base (≈ 1 min)

1. Toujours dans **SQL Editor**
2. Colle et exécute **`supabase-recolte-unlock-rpc.sql`**

Crée la fonction atomique + idempotente `recolte_unlock(...)` et la clé
d'idempotence. Elle n'est appelable **que** par l'Edge Function (service-role).

## Étape 3 — Déployer l'Edge Function (≈ 5 min)

Cette étape nécessite le **CLI Supabase** et l'accès au projet. Si c'est
quelqu'un d'autre qui gère Supabase, transmets-lui cette section + le dossier
`supabase/functions/recolte-unlock/`.

```bash
# une seule fois : installer et se connecter
npm install -g supabase
supabase login
supabase link --project-ref <REF_DU_PROJET_DEV>

# déployer la fonction
supabase functions deploy recolte-unlock
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont **injectés automatiquement**
dans les Edge Functions — rien à configurer.

Test rapide (remplace l'URL et la clé anon) :

```bash
curl -i -X POST \
  "https://<REF>.supabase.co/functions/v1/recolte-unlock" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"access_id":"<ID_TEST>","buyer_type":"batisseur","buyer_id":"<ID>","buyer_nom":"Test","idempotency_key":"test-123"}'
```

Rejouer la même commande (même `idempotency_key`) doit renvoyer
`"status":"already"` **sans** re-débiter → l'idempotence fonctionne.

## Étape 4 — Bascule du front (moi)

Quand les étapes 1-3 sont faites sur **dev**, dis-le-moi : je pousse d'un coup le
front correspondant sur `dev`, à savoir :

- `js/store.js` : lecture/écriture sur `recolte_acces` (`graines_cost`, `places`,
  `places_max`, `hors_exploitation`) au lieu de `offres_mkt` ;
- déverrouillage (`mktConfirmBuy` / semeur / bâtisseur) → **appel de l'Edge
  Function** au lieu d'une écriture directe, avec une clé d'idempotence par clic ;
- contrôle serveur du garde-fou (déjà dans la fonction SQL).

> On garde cet ordre pour éviter toute coupure : la fonction et le nouveau schéma
> doivent exister **avant** que le front s'y branche.

---

## Passage en production (app.evad.org), plus tard

Quand `dev` est validé, on rejoue **exactement les mêmes étapes 1 → 3** sur la base
**prod**, puis on fusionne le front `dev → main`. (Tu m'avais demandé de ne pousser
que sur `dev` pour l'instant : la prod attend ton feu vert.)

## En cas de besoin : revenir en arrière

Exécuter **`supabase-recolte-rollback.sql`** dans le SQL Editor : renomme tout en
sens inverse, sans perte de données. (Et je repousse l'ancien front si besoin.)

---

### Récapitulatif des fichiers préparés
| Fichier | Rôle |
|---|---|
| `supabase-recolte-migration.sql` | Renommage table/colonnes + colonne garde-fou (réversible) |
| `supabase-recolte-rollback.sql` | Annulation de la migration |
| `supabase-recolte-unlock-rpc.sql` | Fonction atomique + idempotente + clé d'idempotence |
| `supabase/functions/recolte-unlock/index.ts` | Edge Function (seul point d'écriture) |
