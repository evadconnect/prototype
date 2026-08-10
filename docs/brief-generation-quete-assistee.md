# Brief stagiaire data & IA — Génération de quête assistée (prototype notebook)

**Objectif de la semaine :** prototyper, dans un notebook (hors de l'app EVAD),
un générateur qui produit une **quête EVAD structurée** à partir soit d'une
**solution de la bibliothèque**, soit d'une **intention libre** écrite par un
Pilote. La sortie doit être un JSON qui se recolle **tel quel** dans le
formulaire de quête de l'app — donc les noms de champs et les valeurs autorisées
ci-dessous sont **contractuels** (ne pas les inventer).

Pas de code dans l'app cette semaine : le livrable est un notebook + un prompt +
une éval. Si c'est concluant, on l'intègre ensuite (bouton « Générer avec Deva »).

---

## 1. Contexte EVAD (le minimum à comprendre)

- Un **Pilote** anime un **lieu**. Un lieu a des **espaces** (jardin, café, fablab…)
  et met en œuvre des **solutions** (récupération d'eau, jardin permaculture…).
- Une **quête** = une action concrète, découpée en étapes, que des **Bâtisseurs**
  viennent réaliser. Chaque quête est reliée à des **indicateurs (ICI)** que sa
  **preuve** viendra alimenter (comptabilité d'impact à 3 capitaux : écologie,
  social, économie locale).
- La preuve fonctionne en **T0 (état initial, avant) → T1 (état final, après)** :
  la différence est l'impact réellement prouvé. La description de preuve générée
  doit encourager ce couple avant/après.
- Ton EVAD : concret, chaleureux, tutoiement, pas de jargon inutile. Public
  souvent **peu à l'aise avec le numérique** → phrases simples et actionnables.

---

## 2. Deux modes d'entrée

**Mode A — depuis une solution** (le plus fréquent) : on fournit au modèle une
solution du catalogue (nom, catégorie, description, budget, ESRS, ICI associés) ;
il en dérive une quête cohérente.

**Mode B — depuis une intention libre** : le Pilote tape une phrase
(« je veux planter une haie le long du potager »), le modèle propose une quête
complète et **rattache les bons ICI** du catalogue.

---

## 3. Contrat de sortie (JSON) — champs de la quête EVAD

Le modèle doit répondre **uniquement** par un objet JSON valide, sans texte
autour, avec exactement ces clés :

```json
{
  "titre": "Installer une cuve de récupération d'eau",
  "desc": "1 à 2 phrases claires : l'action concrète à réaliser sur le lieu.",
  "duree": "1 journée",
  "nb": "3–5 pers.",
  "graines": 50,
  "competence": "💧 Gestion de l'eau",
  "impact": "+8 pts eau · −18 000 L/an",
  "materiel": ["Cuve 1000 L", "Raccords gouttière", "Robinet + trop-plein"],
  "etapes": ["Repérer la descente de gouttière", "Poser la cuve sur assise stable", "Raccorder et tester l'étanchéité"],
  "preuve": "Photo T0 de la gouttière nue, puis T1 cuve installée + relevé du volume collecté après une pluie.",
  "icis": ["eco_eau", "eco_co2"]
}
```

**Règles sur les valeurs :**

- `duree` : uniquement en **journées / demi-journées** (ex. `"1 journée"`,
  `"2 journées"`, `"1 demi-journée"`, `"3 demi-journées"`). Pas d'heures/semaines.
- `nb` : fourchette de personnes (ex. `"2–4 pers."`).
- `graines` : entier, 20–120 selon l'ampleur (repère : 1 demi-journée ≈ 30–40,
  1 journée ≈ 50–60, chantier de plusieurs jours ≈ 80–120).
- `competence` : **exactement** l'une de ces valeurs (sinon `"Aucune en particulier"`) :
  `Aucune en particulier` · `💧 Gestion de l'eau` · `⚡ Énergie` ·
  `🧱 Éco-construction` · `🌾 Maraîchage & permaculture` ·
  `♻️ Réemploi & compostage` · `🌿 Biodiversité` · `🤝 Animation & facilitation` ·
  `🌡 Adaptation climatique` · `🔧 Autre / polyvalent`
- `impact` : court, chiffré, format « +N pts <thème> · <valeur mesurable> ».
- `materiel` / `etapes` : listes courtes (3–6 éléments), concrètes, une action par
  ligne, à l'infinitif pour les étapes.
- `icis` : **uniquement des ids du catalogue ci-dessous**, 1 à 3, cohérents avec
  l'action. Jamais d'id inventé.

---

## 4. Catalogue ICI autorisé (référentiel fermé pour `icis`)

Le modèle ne peut choisir QUE dans cette liste (id → libellé · unité · livre) :

| id | libellé | unité | livre |
|---|---|---|---|
| `eco_co2` | Émissions de CO₂ évitées | kg CO₂e/an | écologie |
| `eco_renat` | Surface renaturée | m² | écologie |
| `eco_eau` | Eau potable économisée | L/an | écologie |
| `eco_enr` | Énergie renouvelable produite | kWh/an | écologie |
| `eco_fraicheur` | Rafraîchissement obtenu | °C en été | écologie |
| `eco_dechets` | Déchets détournés de l'enfouissement | kg/an | écologie |
| `eco_prod_locale` | Production locale | kg/an | écologie |
| `soc_insertion` | Personnes en insertion accueillies | personnes/an | social |
| `soc_formation` | Heures de formation dispensées | heures/an | social |
| `soc_benevoles` | Bénévoles mobilisés | personnes/an | social |
| `soc_sensibilisation` | Personnes sensibilisées | personnes/an | social |
| `soc_evenements` | Événements ouverts organisés | événements/an | social |
| `eco_emplois` | Emplois locaux créés | ETP | économie locale |
| `eco_approv` | Approvisionnement local | % du budget | économie locale |
| `eco_biosource` | Matériaux biosourcés ou réemployés | tonnes/an | économie locale |
| `eco_partenaires` | Partenaires locaux mobilisés | partenaires | économie locale |

(Ces ids proviennent de `js/ici.js` → `ICI_CATALOG`. Si le catalogue évolue, la
source de vérité est la table Supabase `biblio_indicateurs`.)

---

## 5. Prompt système (brouillon à affiner)

> Tu es Deva, l'assistante d'EVAD. Tu aides un Pilote à transformer une solution
> ou une intention en une **quête** concrète que des Bâtisseurs pourront réaliser.
> Réponds UNIQUEMENT par un objet JSON valide (aucun texte avant/après, pas de
> balise de code) respectant exactement ce schéma : {titre, desc, duree, nb,
> graines, competence, impact, materiel[], etapes[], preuve, icis[]}.
> Contraintes :
> - `duree` en journées ou demi-journées uniquement.
> - `competence` : exactement une valeur de la liste fournie, sinon "Aucune en particulier".
> - `icis` : 1 à 3 ids STRICTEMENT tirés du catalogue fourni, cohérents avec l'action ; jamais d'id inventé.
> - `impact` court et chiffré ; `graines` entier 20–120 selon l'ampleur.
> - `materiel` et `etapes` : 3 à 6 éléments concrets, une action par ligne.
> - `preuve` : mentionne un avant/après (T0 état initial, T1 état final) et une valeur mesurable.
> - Langue : français, tutoiement, ton concret et chaleureux, pas de jargon.
> - N'invente aucune donnée réglementaire ; reste réaliste pour un petit lieu.

Le **contexte** (solution ou intention + le catalogue ICI) est passé dans le
message utilisateur. Fournir le catalogue ICI dans le prompt à chaque appel
(liste id + libellé) pour ancrer le choix.

---

## 6. Garde-fous à tester explicitement

1. **ICI hors catalogue** → doit être impossible (rejeter / re-demander si le
   modèle sort un id inconnu ; valider la sortie contre la liste en Python).
2. **Format** : parsing JSON strict + validation du schéma (types, `duree` au bon
   format, `competence` dans la liste, `graines` entier). Compter le taux de
   sorties valides du premier coup.
3. **Réalisme** : pas de chiffres délirants (ex. « −5 000 000 L/an » pour un
   petit jardin). Noter les cas où l'impact est invraisemblable.
4. **Cohérence action ↔ ICI** : une quête « compost » doit relier `eco_dechets`
   (pas `eco_enr`).
5. **Sobriété** : titres et étapes courts, actionnables, sans blabla.

---

## 7. Jeu de test & évaluation

Construire **~20 cas** couvrant les catégories EVAD (eau, énergie, éco-construction,
maraîchage, réemploi/déchets, biodiversité, social/animation, adaptation
climatique) : la moitié en mode A (depuis une solution du catalogue), la moitié en
mode B (intention libre).

Pour chaque cas, noter :

- **JSON valide au 1er coup** (oui/non).
- **ICI corrects** (tous dans le catalogue + pertinents) — note /2.
- **Réalisme des chiffres** (graines, impact) — note /2.
- **Qualité rédactionnelle** (clarté, ton, actionnable) — note /2.

Livrable : un tableau de scores + une synthèse « ce qui marche / ce qui casse » +
2–3 versions du prompt comparées.

---

## 8. Modalités techniques

- **Modèle** : Mistral (EVAD utilise déjà Mistral pour Deva). Tester
  `mistral-small` d'abord (coût/latence), comparer à `mistral-large` sur les cas
  difficiles. Utiliser le **mode JSON / réponse structurée** si disponible.
- **Accès** : le stagiaire prototype avec **sa propre clé Mistral** dans le
  notebook (ne PAS réutiliser la clé de prod ; elle vit en variable
  d'environnement Vercel côté `deva-proxy`, jamais dans le code). En prod, l'appel
  passera par le proxy existant `deva-proxy` — hors périmètre de la semaine.
- **Notebook** : Python (requests/mistralai) ; une cellule = un cas ; sauver les
  entrées/sorties en CSV/JSON pour l'éval.
- **Données d'entrée** : je peux fournir un export des solutions et des ICI
  (depuis `js/app-core.js` → `SOLS` / `SOLS_INDICATORS` et `js/ici.js` →
  `ICI_CATALOG`, ou les tables Supabase `biblio_solutions` / `biblio_indicateurs`).

---

## 9. Livrables attendus (fin de semaine)

1. Notebook reproductible (entrées → appel Mistral → sortie JSON validée).
2. Le **prompt système** retenu (+ variantes testées).
3. Un **validateur Python** de la sortie (schéma + ICI du catalogue + formats).
4. Le **tableau d'évaluation** des ~20 cas + synthèse et recommandations.
5. Une note « prêt à intégrer ? » : taux de sorties valides, coût/latence moyens,
   limites connues.

---

## 10. Bonus / extensions (si temps)

- Générer aussi une **valeur cible réaliste** par ICI (le « point 100 » adapté à
  la taille du lieu) — se relie aux barèmes `biblio_indicateurs`.
- Proposer 2–3 variantes de quête (rapide / ambitieuse) pour laisser le choix au
  Pilote.
- Détecter quand l'intention libre ne correspond à **aucune** solution connue et
  le signaler plutôt que d'inventer.
