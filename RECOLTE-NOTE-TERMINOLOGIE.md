# La Récolte — Note de terminologie (pour validation juridique)

**Objet.** Cadrer le vocabulaire et le fonctionnement du module « la Récolte » d'EVAD,
pour éviter toute assimilation à une activité de vente / place de marché.

**Avertissement.** Ce document décrit une *intention* et des choix de conception. Il
**ne constitue pas un avis juridique** et doit être relu et validé par un·e juriste.
Les points à trancher sont listés en fin de note.

---

## 1. Le principe

« La Récolte » **n'est pas une place de marché**. Un **Pilote** (lieu) **ouvre un accès**
(un atelier, un coup de main, un hébergement, un prêt de matériel…). Cet accès est
**déverrouillé** par des **graines**, la monnaie interne d'EVAD.

- On n'y **vend** rien, on n'y fixe pas de **prix**, on n'y gère pas de **stock**.
- **Aucun euro** n'entre dans le circuit des graines, et **une graine ne se convertit
  jamais en euro** (dans aucun sens).
- Il n'y a **pas de contrepartie réciproque** de type « donnant-donnant » : le Pilote
  **met à disposition**, la graine **déverrouille**.

L'icône du module est **🤲** (« mettre à disposition »), choisie pour écarter toute
connotation de commerce ou d'échange.

## 2. Termes RETENUS (à employer partout)

| Concept | Terme retenu |
|---|---|
| Le module | **la Récolte** |
| L'unité proposée par un lieu | **un accès** |
| Action du lieu | **ouvrir un accès / mettre à disposition** |
| Action du bénéficiaire | **déverrouiller** |
| Coût en monnaie interne | **graines pour déverrouiller** |
| Nombre de bénéficiaires possibles | **places** |
| Le lieu | **Pilote (hôte de l'accès)** |
| Le bénéficiaire | **Bâtisseur** |
| Recevoir la monnaie interne | **recevoir des graines** |
| Attestation obligatoire du Pilote | **« hors exploitation »** (voir §4) |

## 3. Termes PROSCRITS (et pourquoi)

| Terme proscrit | Raison |
|---|---|
| Marketplace / Marché / boutique | Suggère une place de marché commerciale. |
| Vente / vendre / vendeur | Activité commerciale ; pas l'objet du module. |
| Achat / acheter / acheteur | Idem, côté demande. |
| **Prix** | Renvoie à une transaction marchande. On parle de *graines pour déverrouiller*. |
| Stock | Vocabulaire de gestion marchande ; remplacé par *places*. |
| Offre (au sens commercial) | Remplacé par *accès*. |
| **Panier** | Connotation d'achat de biens. Interdit dans le module. |
| **Échange / troc** | **Risque majeur** : l'échange est un **contrat réciproque**, et **fiscalement assimilé à une vente**. Réintroduit exactement la logique qu'on veut écarter. |
| Récompense / gain | Suggère une rémunération. Remplacés par *recevoir / ouvrir / déverrouiller*. |
| Euro / € (dans ce module) | Aucun euro ne doit apparaître dans le circuit des graines. |

## 4. Garde-fous techniques en place

- **Attestation « hors exploitation » obligatoire.** Avant d'ouvrir un accès, le Pilote
  doit cocher : *« Cet accès ne relève pas de l'exploitation économique de mon lieu et
  ne remplace aucun emploi ni prestation que j'aurais facturés. »* La publication est
  **impossible sans cette case**, et le contrôle est **refait côté serveur** (non
  contournable depuis l'interface).
- **Aucun euro** n'est manipulé par le module : ni champ, ni paramètre, ni endpoint.
  Le transfert est **exclusivement en graines**.
- **Pas de conversion** graine ↔ euro, dans aucun sens.
- **Double validation (escrow).** Le déverrouillage se fait en deux temps : le Bâtisseur
  **réserve** (graines bloquées, place décomptée), puis le Pilote **confirme la remise**
  de l'accès ; ce n'est qu'alors que les graines circulent. Annulable tant que non
  confirmé.

## 5. Catégories d'accès

- **Actives :** Formation & atelier, Coup de main, Prêt de matériel, Location d'espace,
  Hébergement, Événement, Culture & art, Accompagnement numérique.
- **Désactivées** (réservées à une phase ultérieure, non visibles) : Alimentation,
  Maraîchage & plants, Artisanat, Textile & couture.
- **Retirées** (zones jugées sensibles / réglementées) : Mobilité, Énergie, Réparation,
  Service, Bien-être & santé.

## 6. Points à faire valider par le/la juriste

1. La formulation de l'**attestation « hors exploitation »** est-elle suffisante, ou
   faut-il la préciser (mention d'un plafond, d'une fréquence, d'un cadre associatif) ?
2. Le vocabulaire retenu (§2) écarte-t-il correctement les qualifications de **vente**,
   d'**échange de services** et de **travail dissimulé** ?
3. La **monnaie interne « graines »** doit-elle être encadrée d'une mention particulière
   (nature, absence de valeur libératoire en euros, non-remboursable) ?
4. Les catégories **désactivées** et **retirées** correspondent-elles au bon découpage
   réglementaire ? Y a-t-il d'autres accès à écarter ?
5. Faut-il des **conditions d'utilisation** spécifiques au module et une information
   claire à l'ouverture d'un accès ?
